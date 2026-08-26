import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck, ArrowRight, CheckCircle2, BarChart3, FileText, ClipboardList,
  Brain, Users2, Clock, AlertTriangle, Scale, UserCheck, FileSearch,
  FileBarChart2, Check, Activity, Database, FileSpreadsheet, Lock, Download,
  Megaphone, History, Building2, Briefcase, ShieldAlert, X as XIcon,
  TrendingUp, Zap, Eye, MessageSquare, Award, LineChart,
  Star, Quote, Timer, Hourglass, User, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoPsicosafety from "@/assets/psicosafety-logo.png";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useState, useEffect } from "react";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PSICOSAFETY — Avaliação psicossocial NR-01, matriz de risco e relatório PGR" },
      { name: "description", content: "Plataforma SaaS para avaliar, classificar e documentar riscos psicossociais conforme NR-01, GRO e PGR. Questionários digitais, matriz de risco automática, dashboards e relatório técnico em poucos cliques." },
      { property: "og:title", content: "PSICOSAFETY — Riscos psicossociais sob controle" },
      { property: "og:description", content: "Do questionário ao PGR em poucos cliques. Avaliação psicossocial estruturada para empresas e consultorias de SST." },
    ],
  }),
  component: Home,
});

const heroSelos = [
  "Conforme NR-01", "COPSOQ + matriz P×S", "Relatório PGR/GRO",
  "Dashboard gerencial", "LGPD", "Pronto em minutos",
];

const dores = [
  { icon: FileSpreadsheet, title: "Planilhas desorganizadas", desc: "Dados espalhados, difíceis de auditar e fáceis de perder." },
  { icon: AlertTriangle, title: "Cálculo manual da matriz", desc: "Probabilidade e severidade classificadas de forma inconsistente." },
  { icon: FileText, title: "Relatórios improvisados", desc: "Documentos sem padronização prejudicam a defesa técnica." },
  { icon: ShieldAlert, title: "Falta de evidência", desc: "Sem rastreabilidade fica difícil comprovar a avaliação." },
  { icon: Brain, title: "Riscos psicossociais ignorados", desc: "Assédio, sobrecarga e conflitos não entram no PGR." },
  { icon: Clock, title: "Tempo perdido", desc: "Horas com tarefas repetitivas que poderiam ser automatizadas." },
];

const antesDepois = {
  antes: [
    "Questionários em papel ou Google Forms",
    "Planilhas confusas e desatualizadas",
    "Cálculo manual da matriz P×S",
    "Relatório demorado e improvisado",
    "Falta de padronização técnica",
    "Difícil comprovar evidências",
    "Pouca clareza sobre setores críticos",
  ],
  depois: [
    "Questionário digital com link único",
    "Dados centralizados e auditáveis",
    "Cálculo automático P×S × Setor",
    "Dashboard visual em tempo real",
    "Relatório técnico padronizado",
    "Plano de ação por fator de risco",
    "Evidências prontas para PGR/GRO",
  ],
};

const passos = [
  { n: "01", icon: ClipboardList, title: "Cadastre a empresa", desc: "Empresa, setores, funções e grupos avaliados em poucos minutos." },
  { n: "02", icon: UserCheck, title: "Envie os questionários", desc: "Link digital seguro para os colaboradores responderem em qualquer dispositivo." },
  { n: "03", icon: FileSearch, title: "Analise os fatores", desc: "Resultados organizados por fator, setor, função ou grupo." },
  { n: "04", icon: BarChart3, title: "Calcule a matriz", desc: "Probabilidade, severidade e nível de risco calculados automaticamente." },
  { n: "05", icon: FileBarChart2, title: "Gere o relatório", desc: "Relatório técnico com gráficos, classificação e plano de ação para o PGR/GRO." },
];

const recursos = [
  { icon: ClipboardList, title: "Questionários digitais", desc: "Avaliação estruturada de carga, liderança, conflitos, assédio, autonomia, reconhecimento e clima." },
  { icon: BarChart3, title: "Matriz de risco automática", desc: "Cálculo automático de probabilidade × severidade conforme critérios definidos." },
  { icon: Activity, title: "Dashboard gerencial", desc: "Indicadores por setor, função, grupo e fator de risco em gráficos claros." },
  { icon: FileBarChart2, title: "Relatório para PGR/GRO", desc: "Documento técnico estruturado para anexar ao Programa de Gerenciamento de Riscos." },
  { icon: Zap, title: "Plano de ação", desc: "Medidas preventivas e corretivas para cada fator de risco identificado." },
  { icon: History, title: "Histórico de avaliações", desc: "Compare resultados ao longo do tempo e acompanhe a evolução." },
  { icon: Building2, title: "Gestão por setores", desc: "Identifique quais áreas concentram maior exposição a riscos psicossociais." },
  { icon: Eye, title: "Evidências para auditoria", desc: "Registros organizados para fiscalizações e revisões internas." },
  { icon: Lock, title: "LGPD e confidencialidade", desc: "Respostas seguras, com proteção e tratamento adequado dos dados." },
  { icon: Megaphone, title: "Canal de denúncia", desc: "Registro seguro de assédio, violência e condutas inadequadas." },
  { icon: TrendingUp, title: "Indicadores por fator", desc: "Veja objetivamente quais fatores apresentam maior criticidade." },
  { icon: Database, title: "Exportação de dados", desc: "Relatórios e dados consolidados em PDF e Excel." },
];

const fatores = [
  "Excesso de demandas", "Ritmo intenso", "Pressão por metas", "Falta de autonomia",
  "Baixo apoio da liderança", "Conflitos interpessoais", "Assédio moral", "Assédio sexual",
  "Violência no trabalho", "Comunicação deficiente", "Falta de reconhecimento", "Insegurança no emprego",
  "Jornada prolongada", "Desequilíbrio trabalho-família", "Clima organizacional negativo",
  "Sobrecarga emocional", "Ambiguidade de papéis", "Isolamento no trabalho",
  "Falta de clareza nas tarefas", "Falta de participação",
];

const nr01Cards = [
  { icon: AlertTriangle, title: "Identificação dos perigos", desc: "Registre os fatores psicossociais presentes no ambiente de trabalho." },
  { icon: BarChart3, title: "Avaliação dos riscos", desc: "Classifique probabilidade, severidade e nível de risco." },
  { icon: ShieldCheck, title: "Controle e prevenção", desc: "Defina medidas para reduzir ou eliminar os riscos identificados." },
  { icon: FileText, title: "Documentação no PGR", desc: "Organize os resultados para compor o GRO/PGR da empresa." },
];

const promessas = [
  { icon: Clock, title: "Menos tempo montando relatório", desc: "Mais tempo fazendo gestão. Automatize etapas repetitivas." },
  { icon: ShieldCheck, title: "Mais segurança técnica", desc: "Critérios claros, evidências organizadas e metodologia padronizada." },
  { icon: LineChart, title: "Dashboards que mostram o problema", desc: "Veja rapidamente onde estão os setores e fatores críticos." },
  { icon: FileBarChart2, title: "Relatórios prontos para o PGR/GRO", desc: "Documentos técnicos com indicadores, classificação e plano de ação." },
  { icon: Zap, title: "Do diagnóstico à ação", desc: "Não apenas mostra o risco: ajuda a organizar o que precisa ser feito." },
  { icon: Award, title: "Gestão sem complicação", desc: "Mesmo sem dominar ferramentas complexas você aplica e documenta." },
];

const planos = [
  {
    nome: "Mensal",
    desc: "Ideal para quem quer começar.",
    precoAvulso: "R$ 1.500,00",
    preco: "R$ 0,99",
    sufixo: "/avaliação",
    economia: "Economia de 80% sobre o valor avulso",
    capacidade: [
      "300 avaliações por mês",
      "Pacote: R$ 297,00/mês à vista",
    ],
    inclusos: [
      { text: "Múltiplas empresas", on: true },
      { text: "Planos de ação automáticos", on: true },
    ],
    cta: "Começar Agora",
    destaque: false,
  },
  {
    nome: "Semestral",
    desc: "Economize 47% e tenha previsibilidade.",
    precoAvulso: "R$ 15.000,00",
    preco: "R$ 0,79",
    sufixo: "/avaliação",
    economia: "Economia de 84% sobre o valor avulso",
    capacidade: [
      "Até 3.000 avaliações no semestre",
      "Pacote: R$ 2.370,00 à vista",
      "ou 6x de R$ 395,00",
    ],
    inclusos: [
      { text: "Múltiplas empresas", on: true },
      { text: "Planos de ação automáticos", on: true },
    ],
    cta: "Assinar Semestral",
    destaque: false,
  },
  {
    nome: "Anual Reduzido",
    desc: "O menor custo por avaliação. Lucro máximo.",
    precoAvulso: "R$ 60.000,00",
    preco: "R$ 0,59",
    sufixo: "/avaliação",
    economia: "Economia de 88% sobre o valor avulso",
    capacidade: [
      "Até 12.000 avaliações no ano",
      "Pacote: R$ 7.080,00 à vista",
      "ou 12x de R$ 590,00",
    ],
    inclusos: [
      { text: "Múltiplas empresas", on: true },
      { text: "Planos de ação automáticos", on: true },
    ],
    cta: "Assinar Plano Anual",
    destaque: true,
  },
];

const faqs = [
  { q: "A plataforma substitui o PGR?", a: "Não. A PSICOSAFETY apoia a avaliação, organização e documentação dos riscos psicossociais, fornecendo dados, matriz, relatórios e planos de ação que servem como base para o PGR/GRO." },
  { q: "Preciso ser psicólogo para usar?", a: "Não. A plataforma foi criada para apoiar profissionais de SST, RH, consultorias e empresas. Dependendo do escopo e da interpretação técnica, pode ser recomendável envolver profissionais especializados." },
  { q: "A plataforma calcula a matriz de risco?", a: "Sim. O sistema calcula probabilidade, severidade e nível de risco conforme critérios definidos pela empresa ou consultoria." },
  { q: "O relatório já sai pronto?", a: "Sim. A plataforma gera relatório estruturado com resultados, gráficos, matriz de risco, classificação e plano de ação." },
  { q: "Posso avaliar por setor?", a: "Sim. É possível organizar avaliações por empresa, setor, função, unidade ou grupo de trabalhadores." },
  { q: "Serve para consultorias?", a: "Sim. O plano Consultoria permite gerenciar várias empresas com dashboards e relatórios personalizados por cliente." },
  { q: "Os dados são protegidos?", a: "Sim. Controle de acesso, respostas organizadas e boas práticas de proteção de dados conforme LGPD." },
  { q: "Posso exportar os relatórios em PDF?", a: "Sim. Todos os relatórios e o PGR podem ser exportados em PDF." },
];

const matrizCells = [
  ["bg-success/70", "bg-success/70", "bg-warning/70", "bg-warning/80", "bg-destructive/70"],
  ["bg-success/70", "bg-warning/60", "bg-warning/80", "bg-destructive/70", "bg-destructive/80"],
  ["bg-warning/60", "bg-warning/80", "bg-destructive/70", "bg-destructive/80", "bg-destructive/90"],
  ["bg-warning/80", "bg-destructive/70", "bg-destructive/80", "bg-destructive/90", "bg-destructive"],
  ["bg-destructive/70", "bg-destructive/80", "bg-destructive/90", "bg-destructive", "bg-destructive"],
];

const numerosProva = [
  { valor: "+3.500", label: "Colaboradores avaliados", desc: "em riscos psicossociais" },
  { valor: "+120", label: "Empresas cadastradas", desc: "usando a plataforma" },
  { valor: "+95%", label: "Taxa média de participação", desc: "nos questionários" },
  { valor: "12h", label: "Economia por relatório", desc: "vs. processo manual" },
  { valor: "100%", label: "Relatórios auditáveis", desc: "prontos para PGR/GRO" },
  { valor: "+40", label: "Fatores de risco mapeáveis", desc: "conforme NR-01" },
];

const depoimentos = [
  {
    nome: "Eng. Carlos Mendes",
    cargo: "Consultor de SST",
    texto: "Antes usávamos planilhas e o relatório demorava 2 dias. Com a PSICOSAFETY, em menos de 2 horas o PGR estava atualizado. Minhas consultorias atendem 3x mais clientes.",
  },
  {
    nome: "Dra. Patrícia Lima",
    cargo: "Médica do Trabalho — SESMT",
    texto: "A matriz de risco automática e os dashboards por setor nos deram clareza absoluta. Conseguimos priorizar as ações preventivas com base real, não em suposição.",
  },
  {
    nome: "Ricardo Souza",
    cargo: "Gerente de RH",
    texto: "Precisávamos de algo simples, mas técnico. O questionário digital foi aceito pelos colaboradores e o relatório foi aprovado pela auditoria sem ressalvas.",
  },
];

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 2, m: 34, s: 12 });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        let { d, h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; d--; }
        if (d < 0) return { d: 0, h: 0, m: 0, s: 0 };
        return { d, h, m, s };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const boxes = [
    { v: String(timeLeft.d).padStart(2, "0"), l: "DIAS" },
    { v: String(timeLeft.h).padStart(2, "0"), l: "HORAS" },
    { v: String(timeLeft.m).padStart(2, "0"), l: "MIN" },
    { v: String(timeLeft.s).padStart(2, "0"), l: "SEG" },
  ];

  return (
    <div className="flex items-center gap-2 justify-center">
      {boxes.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="bg-white/95 text-primary font-black text-2xl md:text-3xl rounded-lg w-12 md:w-16 h-12 md:h-16 grid place-items-center shadow-lg">
              {b.v}
            </div>
            <span className="text-[9px] font-bold text-white/70 mt-1">{b.l}</span>
          </div>
          {i < 3 && <span className="text-white/70 font-black text-xl -mt-4">:</span>}
        </div>
      ))}
    </div>
  );
}

function Home() {
  return (
    <>
      {/* HERO — Cinematic Tech Grid */}
      <section className="relative overflow-hidden hero-cinema text-white font-body">
        <div className="container relative z-10 mx-auto px-5 sm:px-6 pt-12 pb-16 md:pt-24 md:pb-28 grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
          {/* LEFT — copy */}
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="cinema-chip">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 cinema-pulse" />
                Conformidade NR-01
              </span>
              <span className="cinema-chip" style={{ color: "#cbd5e1", background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.12)" }}>
                Metodologia COPSOQ
              </span>
            </div>

            <h1 className="font-display text-[34px] sm:text-5xl lg:text-[68px] font-extrabold leading-[1.04] tracking-tight text-white">
              Da avaliação psicossocial ao{" "}
              <span className="bg-clip-text text-transparent" style={{
                backgroundImage: "linear-gradient(90deg, #22D3EE 0%, #7dd3fc 50%, #6ee7b7 100%)",
              }}>
                PGR — em uma plataforma auditável
              </span>
            </h1>

            <p className="mt-5 md:mt-6 text-base sm:text-lg text-slate-300/90 leading-[1.75] max-w-lg font-light">
              Coleta, apuração, matriz P×S, inventário GRO e plano de ação automatizados.
              Transforme respostas em decisão técnica com segurança jurídica — pronto para fiscalização.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#planos"
                className="cinema-glow-btn inline-flex items-center gap-2 rounded-lg px-6 py-3.5 text-sm font-bold tracking-tight">
                Agendar demonstração
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link to="/como-funciona"
                className="cinema-ghost-btn inline-flex items-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold">
                Explorar plataforma
              </Link>
            </div>

            {/* Métricas inline */}
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              {[
                { v: "100%", l: "Auditável" },
                { v: "NR-01", l: "Conformidade" },
                { v: "12h", l: "Economia/relatório" },
              ].map((m, i) => (
                <div key={m.l} className={`${i > 0 ? "border-l border-white/10 pl-6" : ""}`}>
                  <div className="font-display text-2xl font-bold text-white tracking-tight">{m.v}</div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mt-1">{m.l}</div>
                </div>
              ))}
            </div>

            {/* Selos NR-01 */}
            <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-slate-400">
              {heroSelos.map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80" /> {s}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT — Layered Dashboard Mockup */}
          <div className="relative mt-4 lg:mt-0">
            {/* Glow halo */}
            <div className="absolute -inset-8 rounded-[2rem] pointer-events-none"
              style={{ background: "radial-gradient(closest-side, rgba(34,211,238,0.22), transparent 70%)" }} />

            <div className="relative">
              {/* Main panel */}
              <div className="cinema-card relative p-4 overflow-hidden">
                {/* Window chrome */}
                <div className="flex items-center justify-between px-1 pb-3 mb-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <img src={logoPsicosafety} alt="PSICOSAFETY" className="h-7 w-auto object-contain opacity-90" />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 border-l border-white/10 pl-2">Visão Geral</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 cinema-pulse" /> AO VIVO
                  </span>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { l: "Empresas", v: "12", c: "text-cyan-300" },
                    { l: "Avaliações", v: "150", c: "text-cyan-300" },
                    { l: "Participação", v: "87%", c: "text-emerald-400" },
                    { l: "Críticos", v: "3", c: "text-orange-400" },
                  ].map((k) => (
                    <div key={k.l} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <div className="text-[9px] uppercase tracking-widest text-slate-500">{k.l}</div>
                      <div className={`font-display text-lg font-bold ${k.c} leading-tight mt-0.5`}>{k.v}</div>
                    </div>
                  ))}
                </div>

                {/* Risk Matrix P×S */}
                <div className="rounded-lg border border-white/5 bg-black/20 p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">Matriz P × S</span>
                    <span className="text-[10px] text-slate-500">Probabilidade × Severidade</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      ["bg-emerald-500/60","bg-emerald-500/50","bg-yellow-500/60","bg-orange-500/70","bg-red-500/80"],
                      ["bg-emerald-500/50","bg-yellow-500/60","bg-orange-500/70","bg-red-500/70","bg-red-600/90"],
                      ["bg-yellow-500/60","bg-orange-500/60","bg-red-500/60","bg-red-500/80","bg-red-600"],
                      ["bg-orange-500/60","bg-red-500/60","bg-red-500/80","bg-red-600/90","bg-red-700"],
                      ["bg-red-500/70","bg-red-500/80","bg-red-600/90","bg-red-700","bg-red-700"],
                    ].flat().map((c, i) => (
                      <div key={i} className={`aspect-square rounded-sm ${c} ${i === 12 ? "ring-2 ring-cyan-300 ring-offset-1 ring-offset-[#0A1428]" : ""}`} />
                    ))}
                  </div>
                </div>

                {/* Dimension bars */}
                <div className="space-y-1.5">
                  {[
                    { l: "Exigências quantitativas", v: 82, c: "from-red-500 to-red-400" },
                    { l: "Ritmo de trabalho", v: 71, c: "from-orange-500 to-orange-400" },
                    { l: "Reconhecimento", v: 28, c: "from-emerald-500 to-emerald-400" },
                  ].map((b) => (
                    <div key={b.l}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400">{b.l}</span>
                        <span className="text-white font-semibold tabular-nums">{b.v}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${b.c}`} style={{ width: `${b.v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating: Risk Matrix Card (top-left) */}
              <div className="hidden md:flex absolute -top-6 -left-8 z-20 cinema-card px-4 py-3 items-center gap-3 -rotate-3">
                <div className="h-9 w-9 rounded-lg bg-cyan-400/15 grid place-items-center border border-cyan-400/30">
                  <BarChart3 className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="leading-tight">
                  <div className="text-[9px] uppercase tracking-widest text-cyan-300/80 font-bold">Risco crítico</div>
                  <div className="font-display text-sm font-bold text-white">Linha 3 · Produção</div>
                </div>
              </div>

              {/* Floating: AEP badge (bottom-right) */}
              <div className="hidden md:flex absolute -bottom-6 -right-6 z-20 cinema-card px-4 py-3 items-center gap-3 rotate-2"
                style={{ borderColor: "rgba(110, 231, 183, 0.35)" }}>
                <div className="h-9 w-9 rounded-lg bg-emerald-400/15 grid place-items-center border border-emerald-400/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="leading-tight">
                  <div className="text-[9px] uppercase tracking-widest text-emerald-300/90 font-bold">Relatório AEP</div>
                  <div className="font-display text-sm font-bold text-white">100% conforme</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom proof strip */}
        <div className="relative z-10 border-t border-white/5 bg-black/20 backdrop-blur">
          <div className="container mx-auto px-5 sm:px-6 py-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
            <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-cyan-300" /> NR-01 · Portaria 1.419/2024</span>
            <span className="hidden md:inline h-3 w-px bg-white/10" />
            <span className="flex items-center gap-2"><Brain className="h-3.5 w-3.5 text-cyan-300" /> Domínios COPSOQ</span>
            <span className="hidden md:inline h-3 w-px bg-white/10" />
            <span className="flex items-center gap-2"><FileBarChart2 className="h-3.5 w-3.5 text-cyan-300" /> GRO / PGR</span>
            <span className="hidden md:inline h-3 w-px bg-white/10" />
            <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-cyan-300" /> LGPD</span>
          </div>
        </div>
      </section>

      {/* URGÊNCIA — countdown */}
      <section className="bg-secondary/40 border-y border-border/60">
        <div className="container mx-auto px-5 sm:px-6 py-6 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Hourglass className="h-4 w-4 text-warning" />
            Oferta por tempo limitado — próximas 10 demonstrações deste mês:
          </div>
          <div className="[&_.bg-white\/95]:!bg-primary [&_.bg-white\/95]:!text-primary-foreground [&_.text-white\/70]:!text-muted-foreground">
            <CountdownTimer />
          </div>
        </div>
      </section>


      {/* DOR */}
      <section className="bg-secondary/40 py-10 md:py-24">
        <div className="container mx-auto px-5 sm:px-6">
          <div className="max-w-3xl mx-auto text-center mb-8 md:mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-warning mb-4">
              <AlertTriangle className="h-3.5 w-3.5" /> O problema
            </span>
            <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
              A NR-01 mudou. E agora sua empresa precisa{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                provar que avaliou os riscos psicossociais
              </span>
            </h2>
            <p className="mt-3 md:mt-4 text-muted-foreground text-base md:text-lg leading-[1.7] md:leading-relaxed">
              Não basta apenas falar que existe estresse, cobrança ou conflito. É preciso identificar
              perigos, classificar probabilidade e severidade, registrar evidências e criar plano de
              ação dentro do GRO/PGR.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-5 md:grid-cols-2 lg:grid-cols-3 max-md:[&>*:nth-child(n+5)]:hidden">
            {dores.map((d) => (
              <Card key={d.title} className="border-border/60 hover:border-warning/50 transition-all">
                <CardContent className="p-3 md:pt-6">
                  <div className="h-8 w-8 md:h-11 md:w-11 grid place-items-center rounded-lg md:rounded-xl bg-warning/15 text-warning mb-2 md:mb-4">
                    <d.icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                  </div>
                  <h3 className="font-bold text-[13px] md:text-base leading-tight">{d.title}</h3>
                  <p className="text-[11px] md:text-sm text-muted-foreground mt-1 md:mt-1.5 leading-[1.45] md:leading-relaxed">{d.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* TRANSFORMAÇÃO — antes/depois */}
      <section className="container mx-auto px-5 sm:px-6 py-10 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            <Zap className="h-3.5 w-3.5" /> A transformação
          </span>
          <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
            De planilha confusa para{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              processo auditável
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-5 md:pt-6">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <span className="h-9 w-9 grid place-items-center rounded-full bg-destructive/15 text-destructive">
                  <XIcon className="h-5 w-5" />
                </span>
                <h3 className="font-bold text-lg">Antes da PSICOSAFETY</h3>
              </div>
              <ul className="space-y-2 md:space-y-2.5">
                {antesDepois.antes.map((i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground leading-[1.7]">
                    <XIcon className="h-4 w-4 text-destructive mt-0.5 shrink-0" /> {i}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-success/40" style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--success) 8%, transparent), transparent)" }}>
            <CardContent className="pt-5 md:pt-6">
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <span className="h-9 w-9 grid place-items-center rounded-full text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <h3 className="font-bold text-lg">Depois da PSICOSAFETY</h3>
              </div>
              <ul className="space-y-2 md:space-y-2.5">
                {antesDepois.depois.map((i) => (
                  <li key={i} className="flex gap-2 text-sm leading-[1.7]">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" /> {i}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="bg-secondary/40 py-10 md:py-24">
        <div className="container mx-auto px-5 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
              <Activity className="h-3.5 w-3.5" /> Como funciona
            </span>
            <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
              Em 5 passos, do questionário ao{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>PGR/GRO</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-5 md:grid-cols-2 lg:grid-cols-5">
            {passos.map((p) => (
              <Card key={p.n} className="border-border/60 relative">
                <CardContent className="p-3 md:pt-6">
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <div className="h-8 w-8 md:h-11 md:w-11 grid place-items-center rounded-lg md:rounded-xl text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                      <p.icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                    </div>
                    <span className="text-base md:text-2xl font-black text-primary/15">{p.n}</span>
                  </div>
                  <h3 className="font-bold text-[13px] md:text-base leading-tight">{p.title}</h3>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-1 md:mt-2 leading-[1.45] md:leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-6 md:mt-10">
            <Button asChild size="lg" className="text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
              <a
                href="https://wa.me/5588996349359?text=Ol%C3%A1!%20Quero%20ver%20a%20plataforma%20PSICOSAFETY%20funcionando."
                target="_blank"
                rel="noopener noreferrer"
              >
                Quero ver a plataforma funcionando <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section className="container mx-auto px-5 sm:px-6 py-10 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            <Database className="h-3.5 w-3.5" /> Recursos
          </span>
          <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
            Tudo que você precisa em{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>um só lugar</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-5 md:grid-cols-2 lg:grid-cols-3 max-md:[&>*:nth-child(n+7)]:hidden">
          {recursos.map((r) => (
            <Card key={r.title} className="border-border/60 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)] transition-all">
              <CardContent className="p-3 md:pt-6">
                <div className="h-8 w-8 md:h-11 md:w-11 grid place-items-center rounded-lg md:rounded-xl text-white shadow-[var(--shadow-glow)] mb-2 md:mb-4" style={{ background: "var(--gradient-primary)" }}>
                  <r.icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                </div>
                <h3 className="font-bold text-[13px] md:text-base leading-tight">{r.title}</h3>
                <p className="text-[11px] md:text-sm text-muted-foreground mt-1 md:mt-1.5 leading-[1.45] md:leading-relaxed">{r.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FATORES PSICOSSOCIAIS */}
      <section className="bg-secondary/40 py-10 md:py-24">
        <div className="container mx-auto px-5 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
              <Brain className="h-3.5 w-3.5" /> Fatores avaliados
            </span>
            <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
              Mapeie os principais{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                fatores de risco psicossociais
              </span>
            </h2>
            <p className="mt-3 md:mt-4 text-muted-foreground text-base md:text-lg leading-[1.7] md:leading-relaxed">
              Cada fator pode ser avaliado, classificado e tratado com ações preventivas dentro do GRO/PGR.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 md:flex md:flex-wrap md:gap-2.5 md:justify-center max-w-5xl mx-auto max-md:[&>*:nth-child(n+13)]:hidden">
            {fatores.map((f) => (
              <span key={f} className="px-2.5 py-1.5 md:px-4 md:py-2 rounded-full bg-background border text-[11px] md:text-sm font-medium text-center hover:border-primary/40 hover:text-primary transition-colors cursor-default leading-tight md:whitespace-nowrap">
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* NR-01 */}
      <section className="container mx-auto px-5 sm:px-6 py-10 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            <Scale className="h-3.5 w-3.5" /> NR-01 · GRO · PGR
          </span>
          <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
            Por que avaliar os{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>riscos psicossociais</span>?
          </h2>
          <p className="mt-3 md:mt-4 text-muted-foreground text-base md:text-lg leading-[1.7] md:leading-relaxed">
            A NR-01 exige que empresas identifiquem perigos, avaliem riscos e adotem medidas de
            prevenção — incluindo os fatores psicossociais relacionados à organização do trabalho.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-5 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {nr01Cards.map((c) => (
            <Card key={c.title} className="border-border/60">
              <CardContent className="p-3 md:pt-6">
                <div className="h-8 w-8 md:h-11 md:w-11 grid place-items-center rounded-lg md:rounded-xl text-white shadow-[var(--shadow-glow)] mb-2 md:mb-4" style={{ background: "var(--gradient-primary)" }}>
                  <c.icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
                </div>
                <h3 className="font-bold text-[13px] md:text-base leading-tight">{c.title}</h3>
                <p className="text-[11px] md:text-sm text-muted-foreground mt-1 md:mt-1.5 leading-[1.45] md:leading-relaxed">{c.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* PROMESSAS */}
      <section className="bg-secondary/40 py-10 md:py-24 hidden md:block">
        <div className="container mx-auto px-5 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
              <Award className="h-3.5 w-3.5" /> O que entregamos
            </span>
            <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
              O que a PSICOSAFETY entrega para{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>sua empresa</span>
            </h2>
          </div>

          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {promessas.map((p) => (
              <Card key={p.title} className="border-border/60 hover:shadow-[var(--shadow-elegant)] transition-all">
                <CardContent className="pt-5 md:pt-6">
                  <div className="h-10 w-10 md:h-12 md:w-12 grid place-items-center rounded-xl text-white shadow-[var(--shadow-glow)] mb-3 md:mb-4" style={{ background: "var(--gradient-primary)" }}>
                    <p.icon className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <h3 className="font-bold text-[15px] md:text-lg leading-snug">{p.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 md:mt-2 leading-[1.7] md:leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CONSULTORIAS / EMPRESAS */}
      <section className="container mx-auto px-5 sm:px-6 py-10 md:py-24 hidden md:block">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-6xl mx-auto">
          <Card className="border-border/60 overflow-hidden">
            <div className="h-2" style={{ background: "var(--gradient-primary)" }} />
            <CardContent className="pt-6 md:pt-7">
              <div className="h-12 w-12 grid place-items-center rounded-xl text-white shadow-[var(--shadow-glow)] mb-4" style={{ background: "var(--gradient-primary)" }}>
                <Briefcase className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-bold">Para consultorias de SST</h3>
              <p className="text-muted-foreground mt-2 leading-[1.7]">
                Escale seus atendimentos com mais organização, padrão técnico e agilidade.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Atenda mais clientes", "Padronize seus relatórios", "Dashboards por empresa",
                  "Organize documentos por cliente", "Crie planos de ação personalizados",
                  "Aumente sua autoridade técnica"].map((i) => (
                  <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-success mt-0.5 shrink-0" />{i}</li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                <a href="#planos">Quero usar na minha consultoria</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 overflow-hidden">
            <div className="h-2 bg-success" />
            <CardContent className="pt-6 md:pt-7">
              <div className="h-12 w-12 grid place-items-center rounded-xl bg-success text-white mb-4">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-bold">Para empresas</h3>
              <p className="text-muted-foreground mt-2 leading-[1.7]">
                Cumpra a NR-01, cuide da saúde mental e mantenha o PGR atualizado.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Mais controle sobre os riscos", "Redução de passivos trabalhistas",
                  "Melhor gestão do clima organizacional", "Evidências para auditoria",
                  "Plano de ação preventivo", "Mais segurança para RH, SESMT e direção"].map((i) => (
                  <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-success mt-0.5 shrink-0" />{i}</li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full bg-success hover:bg-success/90 text-white">
                <a href="#planos">Quero adequar minha empresa</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* LGPD */}
      <section className="bg-secondary/40 py-10 md:py-24 hidden md:block">
        <div className="container mx-auto px-5 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-8 md:mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
              <Lock className="h-3.5 w-3.5" /> Segurança e LGPD
            </span>
            <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
              Dados protegidos. Respostas{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>organizadas com segurança</span>
            </h2>
          </div>

          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-5 max-w-6xl mx-auto">
            {[
              { icon: Lock, title: "Controle de acesso", desc: "Apenas usuários autorizados acessam os dados." },
              { icon: Users2, title: "Respostas organizadas", desc: "Dados agrupados para análise técnica." },
              { icon: ShieldCheck, title: "Confidencialidade", desc: "Privacidade dos colaboradores respeitada." },
              { icon: History, title: "Rastreabilidade", desc: "Histórico de avaliações e relatórios." },
              { icon: ShieldAlert, title: "Apoio à LGPD", desc: "Estrutura para tratamento adequado." },
            ].map((c) => (
              <Card key={c.title} className="border-border/60">
                <CardContent className="pt-5 md:pt-6">
                  <c.icon className="h-6 w-6 text-primary mb-3" />
                  <h3 className="font-bold text-sm">{c.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5">{c.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL */}
      <section className="container mx-auto px-5 sm:px-6 py-10 md:py-24">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            <Star className="h-3.5 w-3.5" /> Prova social
          </span>
          <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
            Resultados reais de{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              quem já usa a PSICOSAFETY
            </span>
          </h2>
        </div>

        {/* Números */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 max-w-6xl mx-auto mb-10 md:mb-16 max-md:[&>*:nth-child(n+5)]:hidden">
          {numerosProva.map((n) => (
            <div key={n.label} className="text-center p-4 md:p-5 rounded-2xl border bg-card">
              <div className="text-2xl md:text-3xl lg:text-4xl font-black bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
                {n.valor}
              </div>
              <div className="text-sm font-semibold mt-1">{n.label}</div>
              <div className="text-xs text-muted-foreground">{n.desc}</div>
            </div>
          ))}
        </div>

        {/* Depoimentos */}
        <div className="grid md:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto max-md:[&>*:nth-child(n+2)]:hidden">
          {depoimentos.map((d) => (
            <Card key={d.nome} className="border-border/60 relative">
              <CardContent className="pt-5 pb-5 md:pt-7 md:pb-6">
                <Quote className="h-6 w-6 md:h-8 md:w-8 text-primary/20 absolute top-3 right-3 md:top-4 md:right-4" />
                <div className="flex items-center gap-1 mb-2 md:mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-3 w-3 md:h-3.5 md:w-3.5 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-[1.7] md:leading-relaxed italic">
                  "{d.texto}"
                </p>
                <div className="mt-4 md:mt-5 flex items-center gap-3">
                  <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-secondary grid place-items-center">
                    <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{d.nome}</div>
                    <div className="text-xs text-muted-foreground">{d.cargo}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="container mx-auto px-5 sm:px-6 py-10 md:py-24 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            <BarChart3 className="h-3.5 w-3.5" /> Planos
          </span>
          <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
            Escolha o plano ideal para sua{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>operação</span>
          </h2>
          <p className="mt-3 md:mt-4 text-muted-foreground text-base md:text-lg leading-[1.7] md:leading-relaxed">
            Sem fidelidade. Cancele quando quiser. Upgrade a qualquer momento.
          </p>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {planos.map((p) => (
            <Card key={p.nome} className={`relative flex flex-col ${p.destaque ? "border-primary shadow-[var(--shadow-elegant)] md:scale-[1.03]" : "border-border/60"}`}>
              {p.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                  Mais recomendado
                </span>
              )}
              <CardContent className="p-4 md:pt-8 flex flex-col flex-1">
                <h3 className="font-bold text-base md:text-xl">{p.nome}</h3>
                <p className="text-[12px] md:text-sm text-muted-foreground mt-0.5 md:mt-1 md:min-h-[40px] leading-snug">{p.desc}</p>

                <div className="mt-3 md:mt-4 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] md:text-sm text-muted-foreground line-through">De {p.precoAvulso}</span>
                  <span className="rounded-full border border-success/40 bg-success/10 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-success">
                    Desconto Ativo
                  </span>
                </div>

                <div className="mt-1.5 md:mt-2 flex items-baseline gap-1">
                  <span className="text-3xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>{p.preco}</span>
                  <span className="text-muted-foreground text-sm md:text-base font-medium">{p.sufixo}</span>
                </div>
                <p className="mt-1 text-[11px] md:text-xs font-semibold text-primary">{p.economia}</p>

                <div className="mt-4 md:mt-6 border-t border-border/60 pt-3 md:pt-5">
                  <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 md:mb-3">Capacidade</p>
                  <ul className="space-y-1.5 md:space-y-2.5">
                    {p.capacidade.map((c, i) => (
                      <li key={c} className="flex items-start gap-2 text-[12px] md:text-sm leading-snug">
                        <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary mt-0.5 shrink-0" />
                        <span className={i === 0 ? "font-semibold" : ""}>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 md:mt-5 flex-1">
                  <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 md:mb-3">Incluso no plano</p>
                  <ul className="space-y-1.5 md:space-y-2.5">
                    {p.inclusos.map((it) => (
                      <li key={it.text} className="flex items-start gap-2 text-[12px] md:text-sm leading-snug">
                        {it.on ? (
                          <CheckCircle2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                        )}
                        <span className={it.on ? "" : "text-muted-foreground/70"}>{it.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button asChild className={`mt-4 md:mt-8 w-full ${p.destaque ? "shadow-[var(--shadow-glow)] text-white" : ""}`}
                  variant={p.destaque ? "default" : "outline"}
                  style={p.destaque ? { background: "var(--gradient-primary)" } : undefined}>
                  <Link
                    to="/admin/assinar"
                    onClick={() => {
                      try { sessionStorage.setItem("pendingPlan", p.nome); } catch {}
                    }}
                  >{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6 md:mt-8">
          Precisa de um plano personalizado? <Link to="/contato" className="text-primary font-semibold hover:underline">Fale com nossa equipe.</Link>
        </p>
      </section>

      {/* FAQ */}
      <section className="bg-secondary/40 py-10 md:py-24">
        <div className="container mx-auto px-5 sm:px-6 max-w-3xl">
          <div className="text-center mb-8 md:mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
              <MessageSquare className="h-3.5 w-3.5" /> Dúvidas
            </span>
            <h2 className="text-[26px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
              Ainda em dúvida? <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>Veja por que faz sentido</span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-2 md:space-y-3 max-md:[&>*:nth-child(n+6)]:hidden">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="rounded-xl border bg-background px-4 md:px-5 data-[state=open]:shadow-sm">
                <AccordionTrigger className="text-left text-[15px] md:text-base font-semibold hover:no-underline py-3 md:py-4">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-[1.7] md:leading-relaxed text-sm">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="container mx-auto px-5 sm:px-6 py-10 md:py-24">
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl text-white text-center px-5 py-10 md:px-6 md:py-20" style={{ background: "var(--gradient-hero)" }}>
          <div className="absolute inset-0" style={{ backgroundImage: "var(--gradient-mesh)" }} />
          <div className="relative max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium mb-4 md:mb-6">
              <ShieldCheck className="h-3.5 w-3.5" /> Pronto para começar
            </span>
            <h2 className="text-[24px] leading-[1.15] sm:text-3xl md:text-5xl font-bold">
              Prepare sua empresa para a NR-01{" "}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, #7dd3fc, #6ee7b7)" }}>
                antes que o problema apareça
              </span>
            </h2>
            <p className="mt-3 md:mt-5 text-white/80 text-base md:text-lg leading-[1.7] md:leading-relaxed">
              Avalie hoje. Documente corretamente. Proteja sua empresa e seus trabalhadores.
            </p>
            <div className="mt-5 md:mt-8 flex flex-wrap gap-3 justify-center">
              <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                <a
                  href="https://wa.me/5588996349359?text=Ol%C3%A1!%20Quero%20solicitar%20uma%20demonstra%C3%A7%C3%A3o%20da%20PSICOSAFETY."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Solicitar demonstração agora <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white">
                <a
                  href="https://wa.me/5588996349359?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20um%20especialista%20PSICOSAFETY."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar com especialista
                </a>
              </Button>
            </div>

            {/* Urgência CTA Final */}
            <div className="mt-5 md:mt-6 rounded-xl border border-white/20 bg-white/10 backdrop-blur px-4 py-3 md:py-4 w-full sm:inline-block sm:w-auto mx-auto">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Hourglass className="h-4 w-4 text-warning" />
                  Vagas limitadas este mês:
                </div>
                <CountdownTimer />
              </div>
              <p className="text-xs text-white/60 mt-2 text-center sm:text-left">
                Após o timer zerar, o valor de implementação poderá ser reajustado.
              </p>
            </div>

            <div className="mt-5 md:mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/70">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Sem compromisso</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Demonstração rápida</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Atendimento via WhatsApp</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
