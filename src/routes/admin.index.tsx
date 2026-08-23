import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, FileText, AlertTriangle, TrendingUp, Download, FileBarChart2, Megaphone, ClipboardList, Layers, ListChecks } from "lucide-react";
import { KpiCard } from "@/components/admin/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
  Area, AreaChart, PieChart, Pie,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listEmpresas, listRespostas, type Resposta } from "@/lib/storage";
import { DIMENSIONS, dimensionRiskScore, riskLabel } from "@/lib/copsoq";
import { listarDenuncias } from "@/lib/denuncias";
import { listCampanhas, statusVigencia } from "@/lib/campanhas";
import { getCurrentAccountInfo, type AccountUsage } from "@/lib/account";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const colorMap: Record<string, string> = {
  destructive: "var(--destructive)",
  warning: "var(--warning)",
  primary: "var(--primary)",
  success: "var(--success)",
};

const badgeMap: Record<string, string> = {
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/20 text-warning-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
};

const ALL = "__all__";

function Dashboard() {
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [empresas, setEmpresas] = useState<Awaited<ReturnType<typeof listEmpresas>>>([]);
  const [denuncias, setDenuncias] = useState<{ created_at: string }[]>([]);
  const [campanhas, setCampanhas] = useState<Awaited<ReturnType<typeof listCampanhas>>>([]);
  const [account, setAccount] = useState<AccountUsage | null>(null);
  const [empresaSel, setEmpresaSel] = useState<string>(ALL);
  const [setorSel, setSetorSel] = useState<string>(ALL);
  const [funcaoSel, setFuncaoSel] = useState<string>(ALL);

  useEffect(() => {
    (async () => {
      const info = await getCurrentAccountInfo();
      setAccount(info);
      const ownerOnly = info?.accountType === "consultor";
      const [r, e, c] = await Promise.all([
        listRespostas(),
        listEmpresas(ownerOnly ? { ownerOnly: true } : undefined),
        listCampanhas(ownerOnly ? { ownerOnly: true } : undefined).catch(() => [] as Awaited<ReturnType<typeof listCampanhas>>),
      ]);
      setRespostas(r);
      setEmpresas(e);
      setCampanhas(c);
      try {
        const d = await listarDenuncias();
        setDenuncias(d as any);
      } catch { /* ignore */ }
    })();
  }, []);

  const setoresDisp = useMemo(() => {
    const set = new Set<string>();
    respostas.forEach((r) => {
      if (empresaSel !== ALL && r.codigoEmpresa !== empresaSel) return;
      if (r.setor) set.add(r.setor);
    });
    return [...set].sort();
  }, [respostas, empresaSel]);

  const funcoesDisp = useMemo(() => {
    const set = new Set<string>();
    respostas.forEach((r) => {
      if (empresaSel !== ALL && r.codigoEmpresa !== empresaSel) return;
      if (setorSel !== ALL && r.setor !== setorSel) return;
      if (r.cargo) set.add(r.cargo);
    });
    return [...set].sort();
  }, [respostas, empresaSel, setorSel]);

  const filtradas = useMemo(() => {
    return respostas.filter((r) => {
      if (empresaSel !== ALL && r.codigoEmpresa !== empresaSel) return false;
      if (setorSel !== ALL && r.setor !== setorSel) return false;
      if (funcaoSel !== ALL && r.cargo !== funcaoSel) return false;
      return true;
    });
  }, [respostas, empresaSel, setorSel, funcaoSel]);

  const dimChart = useMemo(() => DIMENSIONS.map((d) => {
    const scores = filtradas.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const { label, color } = riskLabel(avg);
    return { name: d.title.split(" ")[0], score: avg, label, fill: colorMap[color] };
  }), [filtradas]);

  const piorDim = [...dimChart].sort((a, b) => b.score - a.score)[0];
  const mediaGeral = dimChart.length ? Math.round(dimChart.reduce((a, b) => a + b.score, 0) / dimChart.length) : 0;

  // Breakdown por setor
  const porSetor = useMemo(() => agregarPor(filtradas, (r) => r.setor || "(sem setor)"), [filtradas]);
  const porFuncao = useMemo(() => agregarPor(filtradas, (r) => r.cargo || "(sem função)"), [filtradas]);

  // Distribuição por dimensão (donut + barras)
  const distrib = useMemo(() => {
    const total = dimChart.reduce((a, b) => a + b.score, 0) || 1;
    return dimChart.map((d) => ({ ...d, pct: Math.round((d.score / total) * 100) }));
  }, [dimChart]);

  // Histórico últimos 6 meses
  const historico = useMemo(() => {
    const now = new Date();
    const months: { name: string; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
    }
    return months.map((m) => ({
      name: m.name,
      respostas: respostas.filter((r) => ((r as any).criadoEm ?? (r as any).created_at ?? "").slice(0, 7) === m.key).length,
    }));
  }, [respostas]);

  const sparkRespostas = historico.map((h) => ({ x: h.name, y: h.respostas }));

  const totalDenuncias = denuncias.length;
  const denunciasMes = denuncias.filter((d) => {
    const dt = new Date(d.created_at);
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  }).length;

  // Novos KPIs operacionais
  const campanhasAtivas = useMemo(
    () => campanhas.filter((c) => statusVigencia(c) === "ativa").length,
    [campanhas],
  );
  const gesAvaliados = useMemo(() => {
    const set = new Set<string>();
    filtradas.forEach((r) => { if (r.setor) set.add(`${r.codigoEmpresa}::${r.setor}`); });
    return set.size;
  }, [filtradas]);
  const pendenciasCriticas = useMemo(() => {
    // Respostas sem função vinculada (bloqueia AEP) — principal pendência crítica do sistema
    return filtradas.filter((r) => !r.cargo || String(r.cargo).trim() === "").length;
  }, [filtradas]);
  const planosAbertos = 0; // módulo de Planos de Ação ainda não implementado

  const empresaNome = empresaSel === ALL ? "Todas as empresas" : (empresas.find((e) => e.codigo === empresaSel)?.nome ?? empresaSel);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white"
        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: "var(--gradient-mesh)" }} />
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/70 px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> {empresaNome} • Visão geral dos dados
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold mt-3 tracking-tight">Painel Administrativo</h1>
            <p className="text-sm text-white/70 mt-2 max-w-xl">
              Conformidade NR-01 • COPSOQ II • Riscos psicossociais consolidados em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="min-w-[220px]">
              <Select value={empresaSel} onValueChange={(v) => { setEmpresaSel(v); setSetorSel(ALL); setFuncaoSel(ALL); }}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/15 focus:ring-white/40">
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as empresas</SelectItem>
                  {empresas.map((e) => <SelectItem key={e.codigo} value={e.codigo}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs coloridos estilo SaaS premium */}
      {(() => {
        const isConsultor = account?.accountType === "consultor";
        const totalEmpresas = account ? account.empresasUsadas : empresas.length;
        const totalAvaliacoes = account ? account.avaliacoesUsadas : respostas.length;
        const maxAval = account?.plan?.max_avaliacoes ?? 0;
        const restantes = maxAval > 0 ? Math.max(0, maxAval - totalAvaliacoes) : Math.max(0, totalAvaliacoes);
        return (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {!isConsultor && (
              <ColorKpi
                variant="blue"
                icon={Building2}
                label="Total de Empresas"
                value={totalEmpresas}
                spark={sparkRespostas.map((s, i) => ({ x: s.x, y: Math.max(0, Math.round(totalEmpresas * (0.5 + i / 10))) }))}
              />
            )}
            <ColorKpi
              variant="green"
              icon={ClipboardList}
              label="Avaliações Restantes"
              value={restantes}
              sub={maxAval > 0 ? `de ${maxAval}` : undefined}
              spark={sparkRespostas.map((s) => ({ x: s.x, y: Math.max(0, restantes - s.y) }))}
            />
            <ColorKpi
              variant="amber"
              icon={FileBarChart2}
              label="Relatórios Salvos"
              value={0}
              spark={sparkRespostas.map((s) => ({ x: s.x, y: 0 }))}
            />
            <ColorKpi
              variant="violet"
              icon={FileText}
              label="Avaliações Realizadas"
              value={totalAvaliacoes}
              spark={sparkRespostas}
            />
            <ColorKpi
              variant="rose"
              icon={Megaphone}
              label="Denúncias"
              value={totalDenuncias}
              sub={denunciasMes > 0 ? `${denunciasMes} este mês` : undefined}
              spark={sparkRespostas.map((s, i) => ({ x: s.x, y: i === sparkRespostas.length - 1 ? Math.max(0, totalDenuncias) : Math.max(0, Math.round(totalDenuncias * (0.3 + i * 0.1))) }))}
            />
          </div>
        );
      })()}

      {/* KPIs operacionais — visão executiva por status */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={Megaphone}     tone="primary"     label="Campanhas ativas"     value={campanhasAtivas}    hint="Em vigência hoje" />
        <KpiCard icon={Layers}        tone="success"     label="GES avaliados"        value={gesAvaliados}       hint="Setores com respostas no filtro" />
        <KpiCard icon={AlertTriangle} tone="destructive" label="Pendências críticas"  value={pendenciasCriticas} hint="Respostas sem função vinculada" />
        <KpiCard icon={ListChecks}    tone="warning"     label="Planos de ação"       value={planosAbertos}      hint="Em aberto" />
      </div>



      {/* Filtros secundários */}
      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>GES / Setores</Label>
            <Select value={setorSel} onValueChange={(v) => { setSetorSel(v); setFuncaoSel(ALL); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {setoresDisp.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Função</Label>
            <Select value={funcaoSel} onValueChange={setFuncaoSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {funcoesDisp.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por Segmento + Histórico */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Distribuição por Segmento</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Peso relativo de cada dimensão COPSOQ no risco total</p>
              </div>
            </div>
            {filtradas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="h-56 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distrib}
                        dataKey="score"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {distrib.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v}%`, "Risco"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-3xl font-extrabold tracking-tight">{filtradas.length}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">respostas</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {distrib.map((d) => (
                    <div key={d.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                          <span className="font-medium">{d.name}</span>
                        </span>
                        <span className="font-semibold tabular-nums">{d.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.fill }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Histórico de Avaliações</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos 6 meses</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} /> Avaliações Realizadas
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historico}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="respostas" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risco por dimensão */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Risco médio por dimensão</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Média ponderada das respostas filtradas</p>
            </div>
            {piorDim?.score ? (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> Crítico: {piorDim.name} • {piorDim.score}%
              </span>
            ) : null}
          </div>
          {filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              Sem respostas para o filtro selecionado.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dimChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }}
                    formatter={(v: number) => [`${v}%`, "Risco"]}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {dimChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard titulo="Risco por GES / Setores" dados={porSetor} />
        <BreakdownCard titulo="Risco por Função" dados={porFuncao} />
      </div>
    </div>
  );
}

const KPI_VARIANTS = {
  blue:   { bg: "from-sky-50 to-sky-100/60 dark:from-sky-950/40 dark:to-sky-900/20", text: "text-sky-700 dark:text-sky-300", stroke: "rgb(14 165 233)", iconBg: "bg-sky-500/15 text-sky-600 dark:text-sky-300", border: "border-sky-200/60 dark:border-sky-800/40" },
  green:  { bg: "from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", stroke: "rgb(16 185 129)", iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", border: "border-emerald-200/60 dark:border-emerald-800/40" },
  amber:  { bg: "from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20", text: "text-amber-700 dark:text-amber-300", stroke: "rgb(245 158 11)", iconBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300", border: "border-amber-200/60 dark:border-amber-800/40" },
  violet: { bg: "from-violet-50 to-violet-100/60 dark:from-violet-950/40 dark:to-violet-900/20", text: "text-violet-700 dark:text-violet-300", stroke: "rgb(139 92 246)", iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-300", border: "border-violet-200/60 dark:border-violet-800/40" },
  rose:   { bg: "from-rose-50 to-rose-100/60 dark:from-rose-950/40 dark:to-rose-900/20", text: "text-rose-700 dark:text-rose-300", stroke: "rgb(244 63 94)", iconBg: "bg-rose-500/15 text-rose-600 dark:text-rose-300", border: "border-rose-200/60 dark:border-rose-800/40" },
} as const;

function ColorKpi({
  variant, icon: Icon, label, value, sub, spark,
}: {
  variant: keyof typeof KPI_VARIANTS;
  icon: any;
  label: string;
  value: React.ReactNode;
  sub?: string;
  spark: { x: any; y: number }[];
}) {
  const v = KPI_VARIANTS[variant];
  const gid = `spark-${variant}`;
  return (
    <Card className={`relative overflow-hidden border ${v.border} bg-gradient-to-br ${v.bg} hover:shadow-xl transition-all hover:-translate-y-0.5`}>
      <CardContent className="pt-5 pb-3 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className={`text-[10px] font-semibold uppercase tracking-widest ${v.text} leading-tight`}>{label}</div>
            <div className="text-3xl md:text-4xl font-extrabold tracking-tight tabular-nums">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
          </div>
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${v.iconBg} shadow-sm shrink-0`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="h-12 -mx-1 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={v.stroke} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={v.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="y" stroke={v.stroke} strokeWidth={2} fill={`url(#${gid})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

type LinhaAgregada = {
  chave: string;
  n: number;
  media: number;
  label: string;
  color: string;
  porDim: { id: string; score: number }[];
};

function agregarPor(respostas: Resposta[], pickKey: (r: Resposta) => string): LinhaAgregada[] {
  const buckets = new Map<string, Resposta[]>();
  respostas.forEach((r) => {
    const k = pickKey(r);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  });
  const linhas: LinhaAgregada[] = [];
  buckets.forEach((arr, chave) => {
    const porDim = DIMENSIONS.map((d) => {
      const scores = arr.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
      const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { id: d.id, score };
    });
    const media = porDim.length ? Math.round(porDim.reduce((a, b) => a + b.score, 0) / porDim.length) : 0;
    const { label, color } = riskLabel(media);
    linhas.push({ chave, n: arr.length, media, label, color, porDim });
  });
  return linhas.sort((a, b) => b.media - a.media);
}

function BreakdownCard({ titulo, dados }: { titulo: string; dados: LinhaAgregada[] }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="font-semibold mb-4">{titulo}</h2>
        {dados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-center">N</TableHead>
                  <TableHead className="text-center">Média</TableHead>
                  {DIMENSIONS.map((d) => (
                    <TableHead key={d.id} className="text-center text-xs">{d.title.split(" ")[0]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.map((row) => (
                  <TableRow key={row.chave}>
                    <TableCell className="font-medium text-sm">{row.chave}</TableCell>
                    <TableCell className="text-center text-sm">{row.n}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeMap[row.color]}`} title={row.label}>
                        {row.media}%
                      </span>
                    </TableCell>
                    {row.porDim.map((p) => {
                      const { color, label } = riskLabel(p.score);
                      return (
                        <TableCell key={p.id} className="text-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${badgeMap[color]}`} title={label}>
                            {p.score}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="relative overflow-hidden border-border/60 hover:shadow-lg transition-all hover:-translate-y-0.5 group">
      <div
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
        style={{ background: "var(--gradient-primary)" }}
      />
      <CardContent className="pt-6 relative">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider font-medium text-muted-foreground">{label}</div>
          <span
            className="grid h-9 w-9 place-items-center rounded-lg text-white shadow-md"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="text-3xl font-bold mt-3 tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

type ExportArgs = {
  empresaNome: string;
  setor: string;
  funcao: string;
  totalRespostas: number;
  mediaGeral: number;
  piorDim?: { name: string; score: number; label: string };
  dimChart: { name: string; score: number; label: string }[];
  porSetor: LinhaAgregada[];
  porFuncao: LinhaAgregada[];
};

function exportarPDF(args: ExportArgs) {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;

    doc.setFontSize(18);
    doc.text("Relatório de Riscos Psicossociais", margin, y);
    y += 22;
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, margin, y);
    y += 18;

    doc.setTextColor(20);
    doc.setFontSize(11);
    doc.text(`Empresa: ${args.empresaNome}`, margin, y); y += 14;
    doc.text(`GES / Setores: ${args.setor}`, margin, y); y += 14;
    doc.text(`Função: ${args.funcao}`, margin, y); y += 14;
    doc.text(`Respostas no recorte: ${args.totalRespostas}`, margin, y); y += 14;
    doc.text(`Média geral de risco: ${args.mediaGeral}%`, margin, y); y += 14;
    if (args.piorDim?.score) {
      doc.text(`Dimensão crítica: ${args.piorDim.name} (${args.piorDim.score}% • ${args.piorDim.label})`, margin, y);
      y += 18;
    } else {
      y += 4;
    }

    autoTable(doc, {
      startY: y,
      head: [["Dimensão", "Risco médio", "Classificação"]],
      body: args.dimChart.map((d) => [d.name, `${d.score}%`, d.label]),
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 10 },
    });

    const dimHeaders = DIMENSIONS.map((d) => d.title.split(" ")[0]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Risco por GES / Setores", "N", "Média", ...dimHeaders]],
      body: args.porSetor.map((r) => [r.chave, r.n, `${r.media}%`, ...r.porDim.map((p) => `${p.score}`)]),
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Risco por Função", "N", "Média", ...dimHeaders]],
      body: args.porFuncao.map((r) => [r.chave, r.n, `${r.media}%`, ...r.porDim.map((p) => `${p.score}`)]),
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 9 },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        `PsicoSafe — Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: "center" }
      );
    }

    const fname = `psicosafe-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fname);
    toast.success("Relatório PDF gerado");
  } catch (err) {
    console.error("Erro ao gerar PDF", err);
    toast.error("Erro ao gerar PDF");
  }
}
