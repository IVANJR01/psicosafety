import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { bulkImport, type ImportRow, type ImportResult } from "@/lib/storage";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/import")({
  head: () => ({ meta: [{ title: "Importar CSV | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: ImportPage,
});

const TEMPLATE_CSV = `empresa,setor,funcao
Acme Indústria S.A.,Produção,Operador de Máquina
Acme Indústria S.A.,Produção,Líder de Turno
Acme Indústria S.A.,Almoxarifado,Almoxarife
Acme Indústria S.A.,Administrativo,Analista de RH
Beta Serviços Ltda,,Recepcionista
`;

/** Parser CSV simples com suporte a aspas duplas e separador "," ou ";". */
function parseCSV(text: string): { header: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return { header: [], rows: [] };
  const lines = clean.split("\n");
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === sep) { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).filter((l) => l.trim().length > 0).map(parseLine);
  return { header, rows };
}

function rowsToImport(header: string[], rows: string[][]): { data: ImportRow[]; missing?: string } {
  const idxEmp = header.findIndex((h) => h === "empresa");
  const idxSet = header.findIndex((h) => h === "setor" || h === "ges" || h === "ghe");
  const idxFun = header.findIndex((h) => h === "funcao" || h === "função" || h === "cargo");
  if (idxEmp < 0) return { data: [], missing: "Coluna obrigatória 'empresa' não encontrada." };
  const data = rows.map((r) => ({
    empresa: r[idxEmp] ?? "",
    setor: idxSet >= 0 ? r[idxSet] : undefined,
    funcao: idxFun >= 0 ? r[idxFun] : undefined,
  }));
  return { data };
}

function ImportPage() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Arquivo muito grande (máx. 2MB).");
    const text = await file.text();
    setCsvText(text);
    setResult(null);
    doPreview(text);
  };

  const doPreview = (text: string) => {
    const { header, rows } = parseCSV(text);
    if (rows.length === 0) {
      setPreview([]);
      return toast.error("Nenhuma linha encontrada.");
    }
    const { data, missing } = rowsToImport(header, rows);
    if (missing) {
      setPreview(null);
      return toast.error(missing);
    }
    setPreview(data);
  };

  const runImport = async () => {
    if (!preview || preview.length === 0) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await bulkImport(preview);
      setResult(r);
      if (r.erros.length === 0) toast.success("Importação concluída sem erros.");
      else toast.warning(`Importação concluída com ${r.erros.length} erro(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na importação");
    } finally {
      setRunning(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Importar CSV"
        description="Cadastre em lote empresas, GES / Setores e funções. Linhas com a mesma empresa são agrupadas; itens duplicados são ignorados."
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                id="csv-upload"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button asChild variant="default">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" /> Selecionar CSV
                </label>
              </Button>
            </label>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Baixar modelo
            </Button>
            <div className="text-xs text-muted-foreground">
              Colunas aceitas: <code>empresa</code>, <code>setor</code> (ou <code>ges</code>), <code>funcao</code> (ou <code>cargo</code>).
              Separador <code>,</code> ou <code>;</code>.
            </div>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
              <FileText className="h-4 w-4" /> Ou cole o conteúdo do CSV
            </label>
            <Textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setResult(null); }}
              onBlur={() => csvText && doPreview(csvText)}
              rows={8}
              placeholder={TEMPLATE_CSV}
              className="font-mono text-xs"
            />
          </div>

          {preview && preview.length > 0 && (
            <div className="rounded border bg-muted/30 p-3">
              <div className="text-sm font-medium mb-2">
                Pré-visualização ({preview.length} linha{preview.length > 1 ? "s" : ""})
              </div>
              <div className="max-h-64 overflow-auto text-xs">
                <table className="w-full">
                  <thead className="text-muted-foreground">
                    <tr><th className="text-left pr-3">empresa</th><th className="text-left pr-3">setor</th><th className="text-left">funcao</th></tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="pr-3 py-1">{r.empresa}</td>
                        <td className="pr-3 py-1 text-muted-foreground">{r.setor || "—"}</td>
                        <td className="py-1 text-muted-foreground">{r.funcao || "—"}</td>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label="Empresas criadas" value={result.empresasCriadas} />
                <Stat label="Empresas reaproveitadas" value={result.empresasReaproveitadas} />
                <Stat label="Setores criados" value={result.setoresCriados} />
                <Stat label="Funções criadas" value={result.funcoesCriadas} />
              </div>
              {result.erros.length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-medium flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" /> Erros ({result.erros.length})
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-muted/40 p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
