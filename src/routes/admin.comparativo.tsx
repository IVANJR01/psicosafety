import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { GitCompare, TrendingUp, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { listEmpresas, listRespostas, type Resposta, type Empresa } from "@/lib/storage";
import { listCampanhas, type CampanhaComEmpresa } from "@/lib/campanhas";
import { DIMENSIONS, dimensionRiskScore } from "@/lib/copsoq";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/comparativo")({
  head: () => ({ meta: [{ title: "Comparativo | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: Comparativo,
});

type Granularidade = "mes" | "trimestre" | "ano";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(280 65% 60%)",
  "hsl(190 90% 45%)",
  "hsl(330 80% 60%)",
];

function bucketKey(date: Date, g: Granularidade): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (g === "ano") return String(y);
  if (g === "trimestre") return `${y}-T${Math.ceil(m / 3)}`;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function avg(nums: number[]): number {
  const v = nums.filter((n) => n > 0);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}

function Comparativo() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaComEmpresa[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [campanhaSel, setCampanhaSel] = useState<string>("__all__");
  const [granularidade, setGranularidade] = useState<Granularidade>("mes");
  const [dimEvol, setDimEvol] = useState<string>(DIMENSIONS[0].id);

  useEffect(() => {
    (async () => {
      const [e, r, c] = await Promise.all([listEmpresas(), listRespostas(), listCampanhas()]);
      setEmpresas(e);
      setRespostas(r);
      setCampanhas(c);
      const codigosComResp = Array.from(new Set(r.map((x) => x.codigoEmpresa)));
      setSelecionadas(new Set(codigosComResp.slice(0, 3)));
    })();
  }, []);

  const respostasFiltradas = useMemo(
    () => campanhaSel === "__all__" ? respostas : respostas.filter((r) => r.campanhaId === campanhaSel),
    [respostas, campanhaSel],
  );

  const empresasComResp = useMemo(() => {
    const set = new Set(respostasFiltradas.map((r) => r.codigoEmpresa));
    return empresas.filter((e) => set.has(e.codigo));
  }, [empresas, respostasFiltradas]);

  const toggle = (codigo: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  // ---- Comparativo por dimensão entre empresas (barras agrupadas) ----
  const dadosComparativo = useMemo(() => {
    const codigos = [...selecionadas];
    return DIMENSIONS.map((d) => {
      const row: Record<string, string | number> = { dimensao: d.title };
      codigos.forEach((cod) => {
        const arr = respostasFiltradas.filter((r) => r.codigoEmpresa === cod);
        row[cod] = avg(arr.map((r) => dimensionRiskScore(d, r.answers)));
      });
      return row;
    });
  }, [respostasFiltradas, selecionadas]);

  // ---- Evolução temporal por empresa para a dimensão selecionada ----
  const dadosEvolucao = useMemo(() => {
    const dim = DIMENSIONS.find((d) => d.id === dimEvol);
    if (!dim) return [];
    const codigos = [...selecionadas];
    const buckets = new Map<string, Map<string, number[]>>();
    respostasFiltradas.forEach((r) => {
      if (!codigos.includes(r.codigoEmpresa)) return;
      const k = bucketKey(new Date(r.criadoEm), granularidade);
      if (!buckets.has(k)) buckets.set(k, new Map());
      const m = buckets.get(k)!;
      if (!m.has(r.codigoEmpresa)) m.set(r.codigoEmpresa, []);
      m.get(r.codigoEmpresa)!.push(dimensionRiskScore(dim, r.answers));
    });
    const sortedKeys = [...buckets.keys()].sort();
    return sortedKeys.map((k) => {
      const row: Record<string, string | number> = { periodo: k };
      const m = buckets.get(k)!;
      codigos.forEach((cod) => {
        row[cod] = avg(m.get(cod) ?? []);
      });
      return row;
    });
  }, [respostasFiltradas, selecionadas, dimEvol, granularidade]);

  const codigosSel = [...selecionadas];
  const nomeDe = (cod: string) => empresas.find((e) => e.codigo === cod)?.nome ?? cod;

  const exportarPDF = () => {
    if (codigosSel.length === 0) return toast.error("Selecione ao menos uma empresa.");
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 36;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      // Capa
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 90, "F");
      doc.setTextColor(255); doc.setFontSize(16);
      doc.text("Comparativo entre Empresas", margin, 50);
      doc.setFontSize(10); doc.setTextColor(180, 200, 230);
      doc.text("Riscos psicossociais — COPSOQ / NR-01", margin, 70);
      doc.setTextColor(20);

      let y = 120;
      doc.setFontSize(10); doc.setTextColor(80);
      doc.text(`Empresas: ${codigosSel.map(nomeDe).join(", ")}`, margin, y); y += 14;
      const campNome = campanhaSel === "__all__" ? "Todas" : campanhas.find((c) => c.id === campanhaSel)?.nome ?? "—";
      doc.text(`Campanha: ${campNome}`, margin, y); y += 14;
      doc.text(`Granularidade temporal: ${granularidade}`, margin, y); y += 14;
      doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, margin, y); y += 20;

      // Tabela comparativa
      doc.setFontSize(13); doc.setTextColor(30, 64, 175);
      doc.text("Comparativo por dimensão (% risco)", margin, y); y += 8;
      doc.setTextColor(20);
      autoTable(doc, {
        startY: y + 4,
        head: [["Dimensão", ...codigosSel.map(nomeDe)]],
        body: dadosComparativo.map((row) => [
          String(row.dimensao),
          ...codigosSel.map((c) => `${Number(row[c] || 0)}%`),
        ]),
        headStyles: { fillColor: [30, 64, 175], fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 5 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 20;

      // Evolução temporal
      if (dadosEvolucao.length > 0) {
        if (y > pageH - 200) { doc.addPage(); y = margin; }
        const dimTitle = DIMENSIONS.find((d) => d.id === dimEvol)?.title ?? dimEvol;
        doc.setFontSize(13); doc.setTextColor(30, 64, 175);
        doc.text(`Evolução temporal — ${dimTitle}`, margin, y); y += 8;
        doc.setTextColor(20);
        autoTable(doc, {
          startY: y + 4,
          head: [["Período", ...codigosSel.map(nomeDe)]],
          body: dadosEvolucao.map((row) => [
            String(row.periodo),
            ...codigosSel.map((c) => `${Number(row[c] || 0)}%`),
          ]),
          headStyles: { fillColor: [30, 64, 175], fontSize: 10 },
          styles: { fontSize: 9, cellPadding: 5 },
          margin: { left: margin, right: margin },
        });
      }

      doc.setFontSize(8); doc.setTextColor(140);
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 20, { align: "right" });
      }

      doc.save(`comparativo-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span>
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground font-medium mb-1 inline-flex items-center gap-1.5">
              <GitCompare className="h-3 w-3" /> Análise comparativa
            </span>
            Comparativo entre empresas + evolução temporal
          </span>
        }
        description="Compare o nível de risco psicossocial por dimensão entre empresas e acompanhe a evolução ao longo do tempo."
        actions={
          <Button onClick={exportarPDF} disabled={codigosSel.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar PDF
          </Button>
        }
      />

      {/* Filtro de campanha */}
      <Card>
        <CardContent className="pt-6">
          <Label className="text-xs">Campanha</Label>
          <Select value={campanhaSel} onValueChange={setCampanhaSel}>
            <SelectTrigger className="w-full md:w-96 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as campanhas</SelectItem>
              {campanhas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome} — {c.empresa_nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Seleção de empresas */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Empresas (apenas com respostas)</Label>
            <span className="text-xs text-muted-foreground">{selecionadas.size} selecionada(s)</span>
          </div>
          {empresasComResp.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma empresa possui respostas no recorte atual.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {empresasComResp.map((e) => (
                <label key={e.codigo} className="flex items-center gap-2 rounded border bg-card px-3 py-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={selecionadas.has(e.codigo)} onCheckedChange={() => toggle(e.codigo)} />
                  <span className="text-sm truncate" title={e.nome}>{e.nome}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparativo por dimensão */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-1">Comparativo por dimensão</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Média do score de risco (0–100) por dimensão. Quanto maior, maior o risco.
          </p>
          {codigosSel.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Selecione ao menos uma empresa.</p>
          ) : (
            <div style={{ width: "100%", height: 380 }}>
              <ResponsiveContainer>
                <BarChart data={dadosComparativo} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dimensao" angle={-20} textAnchor="end" interval={0} height={80} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  {codigosSel.map((cod, i) => (
                    <Bar key={cod} dataKey={cod} name={nomeDe(cod)} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela de apoio */}
          {codigosSel.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">Dimensão</th>
                    {codigosSel.map((c) => <th key={c} className="text-right px-3 py-2">{nomeDe(c)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dadosComparativo.map((row) => (
                    <tr key={String(row.dimensao)} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{row.dimensao}</td>
                      {codigosSel.map((c) => <td key={c} className="px-3 py-1.5 text-right tabular-nums">{Number(row[c] || 0)}%</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evolução temporal */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Evolução temporal</h2>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <Label className="text-xs">Dimensão</Label>
                <Select value={dimEvol} onValueChange={setDimEvol}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIMENSIONS.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Granularidade</Label>
                <Select value={granularidade} onValueChange={(v) => setGranularidade(v as Granularidade)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes">Mês</SelectItem>
                    <SelectItem value="trimestre">Trimestre</SelectItem>
                    <SelectItem value="ano">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Score médio por período. Períodos sem respostas são omitidos.
          </p>

          {codigosSel.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Selecione ao menos uma empresa.</p>
          ) : dadosEvolucao.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem respostas no recorte.</p>
          ) : (
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <LineChart data={dadosEvolucao} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="periodo" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  {codigosSel.map((cod, i) => (
                    <Line
                      key={cod}
                      type="monotone"
                      dataKey={cod}
                      name={nomeDe(cod)}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
