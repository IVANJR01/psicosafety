import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Download, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { bulkImportRespostas, type ImportRespostaRow, type ImportRespostasResult } from "@/lib/storage";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/import-respostas")({
  head: () => ({ meta: [{ title: "Importar Respostas | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: ImportRespostasPage,
});

const TEMPLATE_JSON = JSON.stringify(
  [
    {
      codigoEmpresa: "ABC123",
      setor: "Produção",
      funcao: "Operador",
      criadoEm: "2024-03-15T10:00:00Z",
      answers: { q1: 4, q2: 3, q3: 5 },
    },
    {
      codigoEmpresa: "ABC123",
      setor: "Administrativo",
      funcao: "Analista de RH",
      criadoEm: "2024-03-16T11:30:00Z",
      answers: { q1: 2, q2: 4, q3: 3 },
    },
  ],
  null,
  2,
);

function ImportRespostasPage() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportRespostaRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportRespostasResult | null>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Arquivo muito grande (máx. 5MB).");
    const t = await file.text();
    setText(t);
    setResult(null);
    doPreview(t);
  };

  const doPreview = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setPreview(null);
        return toast.error("JSON deve ser um array de respostas.");
      }
      const data: ImportRespostaRow[] = parsed.map((r: any, i: number) => {
        if (!r.codigoEmpresa) throw new Error(`Linha ${i + 1}: campo codigoEmpresa ausente`);
        if (!r.answers || typeof r.answers !== "object") throw new Error(`Linha ${i + 1}: answers ausente ou inválido`);
        return {
          codigoEmpresa: String(r.codigoEmpresa),
          setor: r.setor ?? undefined,
          funcao: r.funcao ?? r.cargo ?? undefined,
          answers: r.answers,
          criadoEm: r.criadoEm ?? r.created_at ?? undefined,
        };
      });
      setPreview(data);
    } catch (e: any) {
      setPreview(null);
      toast.error(e?.message ?? "JSON inválido");
    }
  };

  const runImport = async () => {
    if (!preview || preview.length === 0) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await bulkImportRespostas(preview);
      setResult(r);
      if (r.erros.length === 0) toast.success(`${r.inseridas} resposta(s) importada(s).`);
      else toast.warning(`Importação concluída com ${r.erros.length} erro(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na importação");
    } finally {
      setRunning(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_JSON], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-respostas.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Importar Respostas"
        description={
          <>
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground mr-2 align-middle">
              <History className="h-3 w-3" /> Migração de dados históricos
            </span>
            Importe respostas históricas (do APK ou outras fontes) preservando a data original. Formato: JSON com array de objetos contendo <code>codigoEmpresa</code>, <code>answers</code> e opcionalmente <code>setor</code>, <code>funcao</code>, <code>criadoEm</code>.
          </>
        }
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              id="json-upload"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button asChild variant="default">
              <label htmlFor="json-upload" className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" /> Selecionar JSON
              </label>
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Baixar modelo
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
              <FileText className="h-4 w-4" /> Ou cole o JSON aqui
            </label>
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setResult(null); }}
              onBlur={() => text && doPreview(text)}
              rows={10}
              placeholder={TEMPLATE_JSON}
              className="font-mono text-xs"
            />
          </div>

          {preview && preview.length > 0 && (
            <div className="rounded border bg-muted/30 p-3">
              <div className="text-sm font-medium mb-2">
                Pré-visualização ({preview.length} resposta{preview.length > 1 ? "s" : ""})
              </div>
              <div className="max-h-64 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left pr-3">Código</th>
                      <th className="text-left pr-3">Setor</th>
                      <th className="text-left pr-3">Função</th>
                      <th className="text-left pr-3">Data</th>
                      <th className="text-left">Respostas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="pr-3 py-1">{r.codigoEmpresa}</td>
                        <td className="pr-3 py-1 text-muted-foreground">{r.setor || "—"}</td>
                        <td className="pr-3 py-1 text-muted-foreground">{r.funcao || "—"}</td>
                        <td className="pr-3 py-1 text-muted-foreground">{r.criadoEm ? new Date(r.criadoEm).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-1 text-muted-foreground">{Object.keys(r.answers).length} q.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && (
                  <div className="text-muted-foreground mt-2">… mais {preview.length - 50} linha(s)</div>
                )}
              </div>
              <Button className="mt-3" onClick={runImport} disabled={running}>
                {running ? "Importando..." : "Confirmar importação"}
              </Button>
            </div>
          )}

          {result && (
            <div className="rounded border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Resultado
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded bg-muted/40 p-3">
                  <div className="text-2xl font-bold">{result.inseridas}</div>
                  <div className="text-xs text-muted-foreground">Respostas inseridas</div>
                </div>
                <div className="rounded bg-muted/40 p-3">
                  <div className="text-2xl font-bold">{result.erros.length}</div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </div>
              </div>
              {result.erros.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" /> Erros
                  </div>
                  <ul className="mt-1 text-xs space-y-0.5 max-h-40 overflow-auto">
                    {result.erros.map((e, i) => (
                      <li key={i}>Linha {e.linha}: {e.mensagem}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
