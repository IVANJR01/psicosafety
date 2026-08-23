import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, Users, FileText, AlertTriangle } from "lucide-react";
import { getCurrentEmpresa, listRespostasEmpresa, type Empresa, type Resposta } from "@/lib/storage";
import { aggregateDimensions, aggregateBySetor, distribSeveridade, colorForScore } from "@/lib/empresa-stats";
import { gerarPgrPdf } from "@/lib/pgr-pdf";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/empresa/")({
  head: () => ({ meta: [{ title: "Dashboard | Portal da Empresa" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [respostas, setRespostas] = useState<Resposta[]>([]);

  useEffect(() => {
    (async () => {
      const e = await getCurrentEmpresa();
      setEmpresa(e);
      if (e) setRespostas(await listRespostasEmpresa(e.id));
    })();
  }, []);

  const dimAggs = useMemo(() => aggregateDimensions(respostas), [respostas]);
  const setores = useMemo(() => aggregateBySetor(respostas), [respostas]);
  const distrib = useMemo(() => distribSeveridade(respostas), [respostas]);

  const criticos = dimAggs.filter((a) => a.n > 0 && (a.severidade === "alto" || a.severidade === "critico")).length;
  const setoresCount = new Set(respostas.map((r) => r.setor || "(sem)")).size;

  const dimChartData = dimAggs.map((a) => ({
    name: a.dim.title.length > 18 ? a.dim.title.slice(0, 17) + "…" : a.dim.title,
    fullName: a.dim.title,
    score: a.score,
    color: colorForScore(a.score),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral dos riscos psicossociais — {empresa?.nome}
          </p>
        </div>
        <Button onClick={() => empresa && gerarPgrPdf(empresa, respostas)} disabled={!empresa || respostas.length === 0}>
          <FileDown className="h-4 w-4 mr-2" /> Baixar PGR (PDF)
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={<Users className="h-5 w-5" />} label="Respondentes" value={respostas.length} />
        <KPI icon={<FileText className="h-5 w-5" />} label="Setores avaliados" value={setoresCount} />
        <KPI icon={<AlertTriangle className="h-5 w-5" />} label="Dimensões em alerta" value={criticos} accent={criticos > 0 ? "text-warning-foreground" : undefined} />
        <KPI icon={<FileDown className="h-5 w-5" />} label="Total de dimensões" value={dimAggs.length} />
      </div>

      {respostas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Ainda não há respostas. Compartilhe o link do questionário com seus colaboradores:
            </p>
            <code className="mt-3 inline-block px-3 py-1.5 rounded-md bg-secondary font-mono text-sm">
              {typeof window !== "undefined" ? `${window.location.origin}/q/${empresa?.codigo}` : `/q/${empresa?.codigo}`}
            </code>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-4">Score por Dimensão (0–100)</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dimChartData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, "Score"]}
                        labelFormatter={(_, p) => (p?.[0]?.payload as any)?.fullName ?? ""}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {dimChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h2 className="font-semibold mb-4">Distribuição de severidade</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distrib} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {distrib.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Heatmap — Setor × Dimensão</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/empresa/classificacao">Ver classificação completa</Link>
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Setor</th>
                      <th className="p-2">n</th>
                      {dimAggs.map((a) => (
                        <th key={a.dim.id} className="p-2 font-medium" style={{ minWidth: 70 }}>
                          {a.dim.title.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {setores.map((s) => (
                      <tr key={s.setor} className="border-b">
                        <td className="p-2 font-medium">{s.setor}</td>
                        <td className="p-2 text-center text-muted-foreground">{s.n}</td>
                        {s.porDim.map((d) => (
                          <td key={d.dimId} className="p-1 text-center">
                            <div
                              className="rounded px-2 py-1.5 font-bold text-white"
                              style={{ background: colorForScore(d.score) }}
                              title={`${d.dimTitle}: ${d.score}%`}
                            >
                              {d.score}%
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <Legenda cor="#10b981" label="0–29% Baixo" />
                <Legenda cor="#3b82f6" label="30–49% Moderado" />
                <Legenda cor="#f59e0b" label="50–69% Alto" />
                <Legenda cor="#ef4444" label="70–100% Crítico" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className={`text-3xl font-bold mt-1 ${accent ?? ""}`}>{value}</div>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-3 h-3 rounded" style={{ background: cor }} />
      {label}
    </span>
  );
}
