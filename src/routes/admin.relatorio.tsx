import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Download, AlertTriangle, ClipboardList, FileText, ShieldCheck, Copy, ListTodo, BarChart3, FileBarChart2, GitCompare, Loader2 as Spinner } from "lucide-react";
import { gerarPgrPdf } from "@/lib/pgr-pdf";
import { listEmpresas, listRespostas, type Resposta } from "@/lib/storage";
import { listCampanhas, listCampaignSectors, aplicarVigenciaReavaliacao, type CampanhaComEmpresa } from "@/lib/campanhas";
import { DIMENSIONS, dimensionRiskScore, riskLabel } from "@/lib/copsoq";
import { getRecomendacoes, severidadeFromScore, type Severidade } from "@/lib/recomendacoes";
import { toast } from "sonner";
import {
  classifyRisco,
  probFromScorePct,
  DIM_META,
  SEVERIDADE_DIM,
  type ApuLinha,
  type LinhaSetor,
} from "@/lib/risco-matriz";
import { buildAepDataset, lookupGes, formatSetorLabel, formatGes, validarSetorGes, MSG_RELATORIO_GES_BLOQUEADO, type GesMap } from "@/lib/exports/aep-data";
import { carregarGesCadastradosDoModuloSetores } from "@/lib/exports/aep-ges-client";
import { gerarRelatorioAEPpdf } from "@/lib/exports/aep-pdf";
import { AEPErrorDialog, type AEPErrorInfo } from "@/components/admin/AEPErrorDialog";
import { CorrigirFuncoesDialog } from "@/components/admin/CorrigirFuncoesDialog";
import { CorrigirSetorDialog } from "@/components/admin/CorrigirSetorDialog";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/relatorio")({
  head: () => ({ meta: [{ title: "Relatório" }, { name: "robots", content: "noindex" }] }),
  component: Relatorio,
});

const ALL = "__all__";

const sevColor: Record<Severidade, string> = {
  baixo: "bg-success/15 text-success",
  moderado: "bg-primary/15 text-primary",
  alto: "bg-warning/20 text-warning-foreground",
  critico: "bg-destructive/15 text-destructive",
};
const sevLabel: Record<Severidade, string> = {
  baixo: "Baixo", moderado: "Moderado", alto: "Alto", critico: "Crítico",
};

const colorMap: Record<string, string> = {
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/20 text-warning-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
};

function normalizarEscopo(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarGes(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return formatGes(raw).replace(/\s+/g, " ").trim().toUpperCase();
}

function formatDateBR(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("pt-BR");
}

function montarRecorteReavaliacao(
  respostas: Resposta[],
  campanha: CampanhaComEmpresa,
  gesMapAtual: GesMap,
) {
  const escopo = campanha.setores_escopo ?? [];
  const escopoNomes = new Set(escopo.map((s) => normalizarEscopo(s.nome)).filter(Boolean));
  const escopoGes = new Set(escopo.map((s) => normalizarGes(s.ges)).filter(Boolean));
  const inicioMs = new Date(campanha.inicio).getTime();
  const temInicioValido = Number.isFinite(inicioMs);
  const ignoradas = {
    empresaDiferente: 0,
    campanhaDiferente: 0,
    anterioresAoInicio: 0,
    setorForaEscopo: 0,
    incompletas: 0,
  };

  const setorPermitido = (r: Pick<Resposta, "codigoEmpresa" | "setor">) => {
    const setor = normalizarEscopo(r.setor);
    const gesResposta = normalizarGes(lookupGes(r.codigoEmpresa, r.setor ?? "", gesMapAtual));
    if (escopoNomes.size > 0) return !!setor && escopoNomes.has(setor);
    return !!gesResposta && escopoGes.has(gesResposta);
  };

  const validas: Resposta[] = [];
  respostas.forEach((r) => {
    const mesmaEmpresa = r.empresaId
      ? r.empresaId === campanha.empresa_id
      : r.codigoEmpresa === campanha.empresa_codigo;
    if (!mesmaEmpresa) {
      ignoradas.empresaDiferente += 1;
      return;
    }
    if (r.campanhaId !== campanha.id) {
      ignoradas.campanhaDiferente += 1;
      return;
    }
    const criadoMs = new Date(r.criadoEm).getTime();
    if (temInicioValido && Number.isFinite(criadoMs) && criadoMs < inicioMs) {
      ignoradas.anterioresAoInicio += 1;
      return;
    }
    if (!r.codigoEmpresa?.trim() || !r.nomeEmpresa?.trim() || !r.setor?.trim() || !r.cargo?.trim()) {
      ignoradas.incompletas += 1;
      return;
    }
    if (!setorPermitido(r)) {
      ignoradas.setorForaEscopo += 1;
      return;
    }
    validas.push(r);
  });

  return {
    escopo,
    escopoNomes,
    escopoGes,
    ignoradas,
    validas,
    setorPermitido,
    setoresPermitidosLog: escopo.map((s) => formatSetorLabel(s.nome, s.ges)),
  };
}

function datasetDentroDoEscopoReavaliacao(
  datasetSetores: Array<{ setor: string; ges: string | null; label: string }>,
  recorte: ReturnType<typeof montarRecorteReavaliacao>,
) {
  return datasetSetores.filter((s) => {
    const gesOk = s.ges ? recorte.escopoGes.has(normalizarGes(s.ges)) : false;
    const setorOk = recorte.escopoNomes.has(normalizarEscopo(s.setor));
    return !(gesOk || setorOk);
  });
}


function Relatorio() {
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [empresas, setEmpresas] = useState<Awaited<ReturnType<typeof listEmpresas>>>([]);
  const [campanhas, setCampanhas] = useState<CampanhaComEmpresa[]>([]);
  const [gesMap, setGesMap] = useState<GesMap>({});
  const [empresaSel, setEmpresaSel] = useState<string>(ALL);
  const [setorSel, setSetorSel] = useState<string>(ALL);
  const [campanhaSel, setCampanhaSel] = useState<string>(ALL);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroInfo, setErroInfo] = useState<AEPErrorInfo | null>(null);
  const [erroOpen, setErroOpen] = useState(false);
  const [pendentesFuncao, setPendentesFuncao] = useState<Resposta[]>([]);
  const [corrigirOpen, setCorrigirOpen] = useState(false);
  const [pendentesSetor, setPendentesSetor] = useState<Resposta[]>([]);
  const [corrigirSetorOpen, setCorrigirSetorOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, e, c] = await Promise.all([listRespostas(), listEmpresas(), listCampanhas()]);
      setRespostas(r);
      setEmpresas(e);
      setCampanhas(c);
      const ges = await carregarGesCadastradosDoModuloSetores(e);
      setGesMap(ges.gesMap);

      // Deep-link vindo de /admin/campanhas: ?empresa=<codigo>&campanha=<id>
      try {
        const sp = new URLSearchParams(window.location.search);
        const empParam = sp.get("empresa");
        const campParam = sp.get("campanha");
        if (empParam && e.some((x) => x.codigo === empParam)) {
          setEmpresaSel(empParam);
          setSetorSel(ALL);
        }
        if (campParam && c.some((x) => x.id === campParam)) {
          setCampanhaSel(campParam);
        }
      } catch { /* noop */ }
    })();
  }, []);


  const campanhasDisp = useMemo(() => {
    if (empresaSel === ALL) return campanhas;
    return campanhas.filter((c) => c.empresa_codigo === empresaSel);
  }, [campanhas, empresaSel]);

  const campanhaObj = useMemo(
    () => (campanhaSel === ALL ? null : campanhas.find((c) => c.id === campanhaSel) ?? null),
    [campanhas, campanhaSel],
  );
  const isReaval = campanhaObj?.campaign_type === "sector_reassessment";
  const hasEscopoSelecionado = isReaval || campanhaObj?.scope_mode === "selected_sectors";
  const parentCampanha = useMemo(
    () => (campanhaObj?.parent_campaign_id ? campanhas.find((c) => c.id === campanhaObj.parent_campaign_id) ?? null : null),
    [campanhas, campanhaObj],
  );

  // Vigência: quando o filtro não é a própria campanha de reavaliação,
  // remove as respostas antigas dos GES que já tiveram reavaliação com respostas.
  const respostasVigentes = useMemo(() => {
    if (isReaval) return respostas; // recorte da reavaliação já cuida do escopo
    const { respostas: r, substituicoes } = aplicarVigenciaReavaliacao(respostas, campanhas);
    if (substituicoes.length > 0) {
      console.log("[VIGENCIA] GES com reavaliação vigente:", substituicoes.map((s) => `${s.setorNome} → ${s.campanhaVigenteNome}`));
    }
    return r;
  }, [respostas, campanhas, isReaval]);

  // Reavaliações filhas da campanha selecionada — permite ver o "consolidado atualizado"
  // ao selecionar a campanha pai (respostas dos GES reavaliados vêm da reavaliação).
  const childReavalIds = useMemo(() => {
    if (campanhaSel === ALL) return new Set<string>();
    return new Set(
      campanhas
        .filter((c) => c.parent_campaign_id === campanhaSel && c.campaign_type === "sector_reassessment")
        .map((c) => c.id),
    );
  }, [campanhas, campanhaSel]);

  const filtradas = useMemo(() => {
    const base = hasEscopoSelecionado && campanhaObj
      ? montarRecorteReavaliacao(respostas, campanhaObj, gesMap).validas
      : respostasVigentes;
    return base.filter((r) =>
      (empresaSel === ALL || r.codigoEmpresa === empresaSel) &&
      (setorSel === ALL || (r.setor || "(sem setor)") === setorSel) &&
      (campanhaSel === ALL || r.campanhaId === campanhaSel || childReavalIds.has(r.campanhaId ?? "")),
    );
  }, [respostas, respostasVigentes, empresaSel, setorSel, campanhaSel, hasEscopoSelecionado, campanhaObj, gesMap, childReavalIds]);

  const setoresDisp = useMemo(() => {
    const set = new Set<string>();
    const source = hasEscopoSelecionado && campanhaObj
      ? montarRecorteReavaliacao(respostas, campanhaObj, gesMap).validas
      : respostasVigentes;
    source.forEach((r) => {
      if (empresaSel !== ALL && r.codigoEmpresa !== empresaSel) return;
      set.add(r.setor || "(sem setor)");
    });
    return [...set].sort();
  }, [respostas, respostasVigentes, empresaSel, hasEscopoSelecionado, campanhaObj, gesMap]);

  // Apuração GERAL — uma linha por dimensão (média do recorte)
  const apuracaoGeral = useMemo(() => DIMENSIONS.map((d) => {
    const scores = filtradas.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
    const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const sev = SEVERIDADE_DIM[d.id] ?? 3;
    const prob = probFromScorePct(score);
    const risco = classifyRisco(prob, sev);
    return { dim: d, score, prob, sev, risco, n: scores.length };
  }), [filtradas]);

  // Apuração POR GES / SETORES
  const apuracaoSetores: LinhaSetor[] = useMemo(() => {
    const buckets = new Map<string, { arr: Resposta[]; setores: Set<string>; ges: string | null }>();
    filtradas.forEach((r) => {
      const setor = r.setor || "(sem setor)";
      const ges = lookupGes(r.codigoEmpresa, setor, gesMap);
      const k = ges ? `${r.codigoEmpresa.toLowerCase()}|GES|${ges}` : `${r.codigoEmpresa.toLowerCase()}|SETOR|${setor.toUpperCase()}`;
      if (!buckets.has(k)) buckets.set(k, { arr: [], setores: new Set(), ges });
      const bucket = buckets.get(k)!;
      bucket.arr.push(r);
      bucket.setores.add(setor);
    });
    const out: LinhaSetor[] = [];
    buckets.forEach(({ arr, setores, ges }) => {
      const setor = formatSetorLabel([...setores].sort().join(" / "), ges);
      const porDim = DIMENSIONS.map((d) => {
        const scores = arr.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
        const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return { dimId: d.id, dimTitle: d.title, score, sev: severidadeFromScore(score) };
      });
      out.push({ setor, n: arr.length, porDim });
    });
    return out.sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR", { numeric: true }));
  }, [filtradas, gesMap]);

  const empresaNome = empresaSel === ALL
    ? "Todas as empresas"
    : empresas.find((e) => e.codigo === empresaSel)?.nome ?? empresaSel;

  const contextoReavaliacao = useMemo(() => {
    if (!isReaval || !campanhaObj) return undefined;
    const recorte = montarRecorteReavaliacao(respostas, campanhaObj, gesMap);
    return {
      campanhaOriginal: parentCampanha?.nome ?? campanhaObj.nome ?? "—",
      motivo: campanhaObj.notes ?? "",
      setoresEscopo: recorte.setoresPermitidosLog,
      respostasValidas: recorte.validas.length,
    };
  }, [isReaval, campanhaObj, parentCampanha, respostas, gesMap]);

  const comparativoReaval = useMemo(() => {
    if (!isReaval || !campanhaObj) return [] as Array<{
      setor: string; ges: string | null;
      prevScore: number | null; prevDim: string | null; prevBand: string | null;
      curScore: number | null; curDim: string | null; curBand: string | null;
      situacao: string; nCur: number; nPrev: number;
    }>;
    const scoreBand = (s: number) => (s >= 67 ? "ALTO" : s >= 34 ? "MÉDIO" : "BAIXO");
    const rank: Record<string, number> = { BAIXO: 1, "MÉDIO": 2, ALTO: 3 };
    const currentBy = new Map<string, Resposta[]>();
    const parentBy = new Map<string, Resposta[]>();
    const recorte = montarRecorteReavaliacao(respostas, campanhaObj, gesMap);
    recorte.validas.forEach((r) => {
      const key = normalizarEscopo(r.setor);
      if (!key) return;
      const arr = currentBy.get(key) ?? []; arr.push(r); currentBy.set(key, arr);
    });
    respostas.forEach((r) => {
      const key = normalizarEscopo(r.setor);
      if (!key) return;
      if (parentCampanha && r.campanhaId === parentCampanha.id && recorte.setorPermitido(r)) {
        const arr = parentBy.get(key) ?? []; arr.push(r); parentBy.set(key, arr);
      }
    });
    const escopo = campanhaObj.setores_escopo ?? [];
    const labels = escopo.length > 0
      ? escopo.map((s) => ({ nome: s.nome, ges: s.ges ?? null }))
      : [...currentBy.keys()].map((k) => ({ nome: k, ges: null }));
    const computeTop = (arr: Resposta[]): { title: string; score: number } | null => {
      if (arr.length === 0) return null;
      let best: { title: string; score: number } | null = null;
      DIMENSIONS.forEach((d) => {
        const scores = arr.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        if (!best || avg > best.score) best = { title: d.title, score: Math.round(avg) };
      });
      return best;
    };
    return labels.map((s) => {
      const key = normalizarEscopo(s.nome);
      const cur = currentBy.get(key) ?? [];
      const prev = parentBy.get(key) ?? [];
      const prevTop = computeTop(prev);
      const curTop = computeTop(cur);
      let situacao = "Sem dados suficientes";
      if (prevTop && curTop) {
        const pb = scoreBand(prevTop.score), cb = scoreBand(curTop.score);
        if (rank[cb] > rank[pb]) situacao = "Agravado — priorizar";
        else if (pb === "ALTO" && cb === "ALTO") situacao = "Confirmou criticidade";
        else if (pb === "ALTO" && cb === "MÉDIO") situacao = "Redução — monitorar";
        else if (pb === "ALTO" && cb === "BAIXO") situacao = "Não confirmou — validar amostra";
        else situacao = "Estável";
      }
      return {
        setor: s.nome, ges: s.ges,
        prevScore: prevTop?.score ?? null, prevDim: prevTop?.title ?? null,
        prevBand: prevTop ? scoreBand(prevTop.score) : null,
        curScore: curTop?.score ?? null, curDim: curTop?.title ?? null,
        curBand: curTop ? scoreBand(curTop.score) : null,
        situacao, nCur: cur.length, nPrev: prev.length,
      };
    });
  }, [isReaval, campanhaObj, parentCampanha, respostas, gesMap]);

  return (
    <div className="space-y-6 print:space-y-3">
      {/* Cabeçalho */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8 text-white print:hidden"
        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: "var(--gradient-mesh)" }} />
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/70 px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15">
              <FileText className="h-3 w-3" /> Relatório consolidado
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tight">Apuração dos Resultados</h1>
            <p className="text-sm text-white/70 mt-2 max-w-2xl">
              Respostas, classificação automática (NR-01 / GRO) e plano de ações em um único relatório por empresa e GES.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              className="bg-white text-primary hover:bg-white/90 shadow-lg"
              onClick={async () => {
                console.log("[AEP-PDF] Clique no botão Exportar AEP Premium");
                if (gerandoPdf) return;

                const empresaObj = empresaSel === ALL ? null : (empresas.find((e) => e.codigo === empresaSel) ?? null);
                const campanhaObj = campanhaSel === ALL ? null : campanhas.find((c) => c.id === campanhaSel);
                const empresaNomeLog = empresaObj?.nome ?? empresaNome;
                const setorLog = setorSel === ALL ? "Todos" : setorSel;
                const campanhaLog = campanhaObj?.nome ?? "Todas";

                console.log("[AEP-PDF] Clique recebido");
                console.log("[AEP-PDF] Empresa selecionada:", empresaSel, empresaNomeLog);
                console.log("[AEP-PDF] Filtros aplicados:", { setor: setorLog, campanha: campanhaLog });
                console.log("[AEP-PDF] Respostas encontradas:", filtradas.length);

                let etapa = "validacao_inicial";
                let qtdGesCadastrados = 0;
                let qtdGesAvaliados: number | undefined;
                let qtdGesSemAvaliacao: number | undefined;

                const abrirErro = (err: unknown, etapaAtual: string) => {
                  const e = err instanceof Error ? err : new Error(String(err));
                  console.error(`[AEP-PDF] Erro na etapa "${etapaAtual}":`, e);
                  const info: AEPErrorInfo = {
                    etapa: etapaAtual,
                    empresaCodigo: empresaSel === ALL ? "" : empresaSel,
                    empresaNome: empresaNomeLog,
                    campanha: campanhaLog,
                    setor: setorLog,
                    qtdRespostas: filtradas.length,
                    qtdGesCadastrados,
                    qtdGesAvaliados,
                    qtdGesSemAvaliacao,
                    somenteAvaliados: false,
                    rascunho: false,
                    errorName: e.name || "Error",
                    errorMessage: e.message || String(err),
                    errorCode: (err as any)?.code ? String((err as any).code) : undefined,
                    stack: e.stack,
                    ambiente: typeof window !== "undefined" ? window.location.hostname : "—",
                    timestamp: new Date().toISOString(),
                  };
                  setErroInfo(info);
                  const pend = (err as any)?.pendentes as Resposta[] | undefined;
                  const code = (err as any)?.code;
                  if (code === "FUNCAO_OBRIGATORIA" && pend && pend.length > 0) {
                    setPendentesFuncao(pend);
                    setCorrigirOpen(true);
                    toast.error(`${pend.length} resposta(s) sem função — corrija no diálogo aberto.`, { duration: 10000 });
                  } else if (code === "SETOR_OBRIGATORIO" && pend && pend.length > 0) {
                    setPendentesSetor(pend);
                    setCorrigirSetorOpen(true);
                    toast.error(`${pend.length} resposta(s) sem setor — escolha o destino no diálogo aberto.`, { duration: 10000 });
                  } else {
                    setErroOpen(true);
                    toast.error(`Falha ao gerar AEP — ${etapaAtual}`, { duration: 10000 });
                  }
                };

                setGerandoPdf(true);
                const loadingId = toast.loading("Gerando PDF AEP Premium...");

                try {
                  etapa = "validacao_empresa";
                  if (empresaSel === ALL) {
                    throw new Error("Selecione uma empresa específica antes de exportar o AEP Premium. 'Todas as empresas' não é suportado.");
                  }
                  if (!empresaObj) {
                    throw new Error("Empresa selecionada não encontrada no cadastro.");
                  }
                  if (filtradas.length === 0) {
                    throw new Error("Não existem respostas no recorte atual. Ajuste os filtros e tente novamente.");
                  }

                  etapa = "carregar_dimensoes";
                  console.log("[AEP-PDF] Iniciando montagem do relatório");
                  const { loadDimensions } = await import("@/lib/copsoq");
                  await loadDimensions(true);

                  etapa = "carregar_ges";
                  const gesAtual = await carregarGesCadastradosDoModuloSetores(empresas, empresaSel);
                  if (Object.keys(gesAtual.gesMap).length > 0) setGesMap(gesAtual.gesMap);
                  let gesCadFiltro = gesAtual.rows;

                  const gesMapAtual = Object.keys(gesAtual.gesMap).length > 0 ? gesAtual.gesMap : gesMap;

                  // === Campanha com escopo selecionado: restringir respostas e GES ===
                  let respostasParaDataset = filtradas;
                  let recorteReavaliacaoExport: ReturnType<typeof montarRecorteReavaliacao> | null = null;
                  if (hasEscopoSelecionado && campanhaObj) {
                    const escopoAtualizado = await listCampaignSectors(campanhaObj.id);
                    if (escopoAtualizado.length === 0) {
                      throw new Error("Não é possível gerar relatório de reavaliação: a campanha não possui setores/GES selecionados no escopo.");
                    }
                    const campanhaEscopada: CampanhaComEmpresa = {
                      ...campanhaObj,
                      setores_escopo: escopoAtualizado,
                    };
                    const recorte = montarRecorteReavaliacao(respostas, campanhaEscopada, gesMapAtual);
                    recorteReavaliacaoExport = recorte;

                    console.log("[AEP-REAVALIACAO] campaign_id usado:", campanhaEscopada.id);
                    console.log("[AEP-REAVALIACAO] setores permitidos:", recorte.setoresPermitidosLog);

                    respostasParaDataset = recorte.validas;
                    console.log("[AEP-REAVALIACAO] respostas válidas da reavaliação:", respostasParaDataset.length);
                    console.log("[AEP-REAVALIACAO] respostas ignoradas por empresa diferente:", recorte.ignoradas.empresaDiferente);
                    console.log("[AEP-REAVALIACAO] respostas ignoradas por campanha diferente:", recorte.ignoradas.campanhaDiferente);
                    console.log("[AEP-REAVALIACAO] respostas ignoradas por setor fora do escopo:", recorte.ignoradas.setorForaEscopo);
                    console.log("[AEP-REAVALIACAO] respostas ignoradas por data anterior ao início:", recorte.ignoradas.anterioresAoInicio);
                    console.log("[AEP-REAVALIACAO] respostas ignoradas por cadastro incompleto:", recorte.ignoradas.incompletas);

                    if (respostasParaDataset.length === 0) {
                      throw new Error("Não é possível gerar relatório de reavaliação: não há respostas válidas novas para os setores/GES selecionados.");
                    }

                    gesCadFiltro = gesCadFiltro.filter((g) => {
                      const setorOk = recorte.escopoNomes.has(normalizarEscopo(g.setor));
                      const gesOkSemNome = recorte.escopoNomes.size === 0 && recorte.escopoGes.has(normalizarGes(g.ges));
                      return setorOk || gesOkSemNome;
                    });
                    if (gesCadFiltro.length === 0) {
                      throw new Error("O relatório de reavaliação está tentando incluir setores fora do escopo da campanha.");
                    }
                  }

                  qtdGesCadastrados = gesCadFiltro.length;
                  console.log("[AEP-PDF] GES carregados:", qtdGesCadastrados);
                  if (gesCadFiltro.length === 0) {
                    throw new Error("Não há GES cadastrados para esta empresa. Cadastre os Grupos de Exposição Similar no módulo Setores antes de exportar.");
                  }

                  etapa = "validacao_ges_respostas";
                  const semSetor = respostasParaDataset.filter((r) => !(r.setor?.trim()));
                  if (semSetor.length > 0) {
                    const ids = semSetor.slice(0, 5).map((r) => r.id).join(", ");
                    const err: any = new Error(
                      `${semSetor.length} resposta(s) estão sem setor preenchido. Use o saneamento para vincular ou descartar. IDs: ${ids}${semSetor.length > 5 ? "…" : ""}.`,
                    );
                    err.code = "SETOR_OBRIGATORIO";
                    err.pendentes = semSetor;
                    throw err;
                  }
                  const validacao = validarSetorGes(respostasParaDataset, gesMapAtual);
                  if (validacao.semGes.length > 0) {
                    const lista = validacao.semGes
                      .slice(0, 5)
                      .map((x) => `"${x.setor}"${x.codigo ? ` (${x.codigo})` : ""}`)
                      .join(", ");
                    throw new Error(
                      `${validacao.semGes.length} setor(es) sem GES cadastrado: ${lista}${validacao.semGes.length > 5 ? "…" : ""}. Abra Admin → Setores e vincule cada setor a um GES.`,
                    );
                  }

                  etapa = "montar_dataset";
                  console.log("[AEP-PDF] Dados da empresa carregados");
                  // Estrutura da versão em que as respostas foram dadas — mesmo
                  // motivo do AEPModal: trocado o instrumento, os códigos de
                  // `answers` não existem na versão nova e o escore zera.
                  const versaoDoRecorte =
                    respostasParaDataset.find((r) => r.versaoId)?.versaoId ?? null;
                  const dimensoesDoRecorte = versaoDoRecorte
                    ? await (await import("@/lib/copsoq")).dimensoesDaVersao(versaoDoRecorte)
                    : undefined;
                  const dataset = buildAepDataset({
                    dimensoes: dimensoesDoRecorte,
                    empresa: empresaObj as any,
                    empresaNome: empresaNomeLog,
                    setorFiltro: setorLog,
                    campanhaNome: campanhaLog,
                    periodo: hasEscopoSelecionado && campanhaObj ? { inicio: formatDateBR(campanhaObj.inicio), fim: formatDateBR(campanhaObj.fim) } : undefined,
                    responsavelTecnico: (empresaObj as any)?.responsavel_nome || "Equipe Técnica PSICOSAFETY",
                    respostas: respostasParaDataset,
                    gesPorSetor: gesMapAtual,
                    agruparPorGes: true,
                    gesCadastrados: gesCadFiltro,
                    escopoSetorialPermitido: recorteReavaliacaoExport?.escopo,
                  });
                  qtdGesAvaliados = dataset.gesAvaliados.length;
                  qtdGesSemAvaliacao = dataset.gesSemAvaliacao.length;
                  console.log("[AEP-PDF] Inventário carregado · GES avaliados:", qtdGesAvaliados, "· sem aval.:", qtdGesSemAvaliacao);
                  if (qtdGesAvaliados === 0) {
                    throw new Error("Não há GES avaliados no recorte. Sem dados suficientes para gerar o AEP.");
                  }
                  if (hasEscopoSelecionado && campanhaObj) {
                    const recorteFinal = recorteReavaliacaoExport ?? montarRecorteReavaliacao(respostas, campanhaObj, gesMapAtual);
                    const foraDataset = datasetDentroDoEscopoReavaliacao(dataset.setores, recorteFinal);
                    if (foraDataset.length > 0) {
                      console.error("[AEP-REAVALIACAO] setores fora do escopo detectados no dataset:", foraDataset.map((s) => s.label));
                      throw new Error("O relatório de reavaliação está tentando incluir setores fora do escopo da campanha.");
                    }
                  }

                  etapa = "gerar_pdf";
                  console.log("[AEP-PDF] Gerando PDF");
                  const controlesMap = dataset.empresa
                    ? await (await import("@/lib/control-measures")).carregarControlesExistentes(dataset.empresa.id)
                    : undefined;
                  await gerarRelatorioAEPpdf(dataset, {
                    incluirGraficos: true,
                    incluirPlanoAcao: true,
                    incluirAnexos: true,
                    throwOnError: true,
                    controlesMap: controlesMap as any,
                    contextoReavaliacao: isReaval && campanhaObj ? {
                      campanhaOriginal: parentCampanha?.nome ?? campanhaObj.nome ?? "—",
                      motivo: campanhaObj.notes ?? "",
                      setoresEscopo: recorteReavaliacaoExport?.setoresPermitidosLog ?? montarRecorteReavaliacao(respostas, campanhaObj, gesMapAtual).setoresPermitidosLog,
                      respostasValidas: respostasParaDataset.length,
                    } : contextoReavaliacao,
                    onStep: (s) => {
                      etapa = `pdf:${s}`;
                      console.log("[AEP-PDF] etapa PDF:", s);
                    },
                  });

                  console.log("[AEP-PDF] Download iniciado");
                  toast.dismiss(loadingId);
                  toast.success("PDF AEP Premium gerado com sucesso.");
                } catch (err) {
                  toast.dismiss(loadingId);
                  abrirErro(err, etapa);
                } finally {
                  setGerandoPdf(false);
                }
              }}
              disabled={filtradas.length === 0 || gerandoPdf}
            >
              {gerandoPdf ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Gerando PDF AEP Premium...</>
              ) : (
                <><Download className="h-4 w-4 mr-1.5" /> Exportar AEP Premium</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {isReaval && campanhaObj && (
        <Card className="border-primary/40 bg-primary/5 print:hidden">
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default" className="bg-primary text-primary-foreground">
                <GitCompare className="h-3 w-3 mr-1" /> Reavaliação Setorial Complementar
              </Badge>
              {parentCampanha && (
                <span className="text-xs text-muted-foreground">
                  Campanha original: <strong className="text-foreground">{parentCampanha.nome}</strong>
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Respostas válidas: <strong className="text-foreground tabular-nums">{contextoReavaliacao?.respostasValidas ?? 0}</strong>
              </span>
            </div>
            {campanhaObj.notes && (
              <p className="text-sm text-foreground/80">
                <strong>Motivo:</strong> {campanhaObj.notes}
              </p>
            )}
            {(campanhaObj.setores_escopo ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                <strong>Setores/GES reavaliados:</strong>{" "}
                {(campanhaObj.setores_escopo ?? []).map((s) => (s.ges ? `${s.nome} (GES ${s.ges})` : s.nome)).join(", ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground italic">
              Os resultados representam apenas o recorte selecionado — não a totalidade da empresa.
            </p>
          </CardContent>
        </Card>
      )}



      <AEPErrorDialog open={erroOpen} onOpenChange={setErroOpen} info={erroInfo} />
      <CorrigirFuncoesDialog
        open={corrigirOpen}
        onOpenChange={setCorrigirOpen}
        pendentes={pendentesFuncao}
        onCorrigido={async () => {
          setCorrigirOpen(false);
          const r = await listRespostas();
          setRespostas(r);
          toast.success("Funções atualizadas. Clique em Exportar AEP Premium novamente.");
        }}
      />
      <CorrigirSetorDialog
        open={corrigirSetorOpen}
        onOpenChange={setCorrigirSetorOpen}
        pendentes={pendentesSetor}
        todasRespostas={respostas}
        gesMap={gesMap}
        campanhas={campanhas}
        onCorrigido={async () => {
          setCorrigirSetorOpen(false);
          const r = await listRespostas();
          setRespostas(r);
          toast.success("Saneamento aplicado. Clique em Exportar AEP Premium para revalidar.");
        }}
      />

      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-4">
          <div>
            <Label>Empresa</Label>
            <Select value={empresaSel} onValueChange={(v) => { setEmpresaSel(v); setSetorSel(ALL); setCampanhaSel(ALL); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {empresas.map((e) => <SelectItem key={e.codigo} value={e.codigo}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Campanha</Label>
            <Select value={campanhaSel} onValueChange={setCampanhaSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {campanhasDisp.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}{empresaSel === ALL ? ` — ${c.empresa_nome}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>GES / Setores</Label>
            <Select value={setorSel} onValueChange={setSetorSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {setoresDisp.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground tabular-nums">{filtradas.length}</strong> resposta(s) no recorte • Empresa: <strong className="text-foreground">{empresaNome}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modo do relatório (banner) */}
      {campanhaObj && (
        <Card className={`print:hidden ${isReaval ? "border-primary/40 bg-primary/5" : childReavalIds.size > 0 ? "border-warning/40 bg-warning/5" : ""}`}>
          <CardContent className="pt-6 text-sm space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">
                {isReaval
                  ? "Modo: Reavaliação setorial"
                  : childReavalIds.size > 0
                    ? "Modo: Consolidado atualizado (com reavaliação vigente)"
                    : "Modo: Relatório da campanha"}
              </Badge>
              <span className="text-muted-foreground">
                <strong className="text-foreground">{campanhaObj.empresa_nome}</strong> · {campanhaObj.nome}
              </span>
            </div>
            {isReaval && (campanhaObj.setores_escopo ?? []).length > 0 && (
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Setores/GES da reavaliação:</strong>{" "}
                {(campanhaObj.setores_escopo ?? []).map((s) => s.ges ? `${s.nome} (GES ${s.ges})` : s.nome).join(", ")}
              </div>
            )}
            {!isReaval && childReavalIds.size > 0 && (
              <div className="text-xs text-muted-foreground">
                GES reavaliados nesta empresa usam as respostas novas da reavaliação; os demais GES mantêm o resultado da avaliação original.
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground tabular-nums">{filtradas.length}</strong> resposta(s) válidas neste recorte.
            </div>
          </CardContent>
        </Card>
      )}


      {/* Painel de erro inline — visível mesmo sem abrir o diálogo */}
      {erroInfo && (
        <Card className="border-destructive/40 bg-destructive/5 print:hidden">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-destructive">
                  Falha ao gerar AEP Premium — etapa: {erroInfo.etapa}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 break-words">{erroInfo.errorMessage}</p>
                <div className="mt-3 grid gap-1 sm:grid-cols-2 text-xs text-muted-foreground">
                  <div><strong className="text-foreground">Empresa:</strong> {erroInfo.empresaNome}</div>
                  <div><strong className="text-foreground">Campanha:</strong> {erroInfo.campanha}</div>
                  <div><strong className="text-foreground">Setor/GES:</strong> {erroInfo.setor}</div>
                  <div><strong className="text-foreground">Respostas:</strong> {erroInfo.qtdRespostas}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setErroOpen(true)}>
                    Ver detalhes completos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const txt = JSON.stringify(erroInfo, null, 2);
                        await navigator.clipboard.writeText(txt);
                        toast.success("Diagnóstico copiado.");
                      } catch {
                        toast.error("Não foi possível copiar.");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1.5" /> Copiar diagnóstico
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setErroInfo(null)}>
                    Dispensar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Apuração / Respostas / AEP Premium / Inventário PGR / Plano de ação */}
      <Tabs defaultValue="apuracao" className="space-y-4 print:hidden">
        <TabsList className={`grid grid-cols-2 ${isReaval ? "md:grid-cols-6" : "md:grid-cols-5"} w-full`}>
          <TabsTrigger value="apuracao"><ShieldCheck className="h-4 w-4 mr-1.5" /> Apuração</TabsTrigger>
          <TabsTrigger value="respostas"><FileText className="h-4 w-4 mr-1.5" /> Respostas</TabsTrigger>
          <TabsTrigger value="aep"><BarChart3 className="h-4 w-4 mr-1.5" /> AEP Premium</TabsTrigger>
          <TabsTrigger value="pgr"><FileBarChart2 className="h-4 w-4 mr-1.5" /> Inventário PGR</TabsTrigger>
          <TabsTrigger value="plano"><ListTodo className="h-4 w-4 mr-1.5" /> Plano de Ação</TabsTrigger>
          {isReaval && (
            <TabsTrigger value="comparativo"><GitCompare className="h-4 w-4 mr-1.5" /> Comparativo</TabsTrigger>
          )}
        </TabsList>

        {isReaval && (
          <TabsContent value="comparativo">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Comparativo Avaliação Original × Reavaliação</h2>
                  <p className="text-sm text-muted-foreground">
                    Domínio de maior criticidade por setor/GES na avaliação anterior versus a reavaliação atual.
                  </p>
                </div>
                {comparativoReaval.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Sem setores no escopo da reavaliação.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Setor / GES</TableHead>
                          <TableHead>Domínio anterior</TableHead>
                          <TableHead className="text-center">% anterior</TableHead>
                          <TableHead className="text-center">Classif. anterior</TableHead>
                          <TableHead>Domínio reavaliação</TableHead>
                          <TableHead className="text-center">% reavaliação</TableHead>
                          <TableHead className="text-center">Classif. reavaliação</TableHead>
                          <TableHead>Situação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativoReaval.map((r) => {
                          const bandCls = (b: string | null) =>
                            b === "ALTO" ? "bg-destructive/15 text-destructive"
                            : b === "MÉDIO" ? "bg-warning/20 text-warning-foreground"
                            : b === "BAIXO" ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground";
                          const sitCls =
                            r.situacao.startsWith("Agravado") ? "bg-destructive/15 text-destructive"
                            : r.situacao.startsWith("Confirmou") ? "bg-warning/20 text-warning-foreground"
                            : r.situacao.startsWith("Redução") ? "bg-primary/15 text-primary"
                            : r.situacao.startsWith("Não confirmou") ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground";
                          return (
                            <TableRow key={r.setor}>
                              <TableCell className="font-medium">
                                {r.setor}{r.ges ? <span className="text-muted-foreground"> — GES {r.ges}</span> : null}
                                <div className="text-xs text-muted-foreground">
                                  Respostas: {r.nPrev} → {r.nCur}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{r.prevDim ?? "—"}</TableCell>
                              <TableCell className="text-center tabular-nums">{r.prevScore ?? "—"}{r.prevScore != null ? "%" : ""}</TableCell>
                              <TableCell className="text-center"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${bandCls(r.prevBand)}`}>{r.prevBand ?? "—"}</span></TableCell>
                              <TableCell className="text-sm">{r.curDim ?? "—"}</TableCell>
                              <TableCell className="text-center tabular-nums">{r.curScore ?? "—"}{r.curScore != null ? "%" : ""}</TableCell>
                              <TableCell className="text-center"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${bandCls(r.curBand)}`}>{r.curBand ?? "—"}</span></TableCell>
                              <TableCell><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${sitCls}`}>{r.situacao}</span></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="text-xs text-muted-foreground italic">
                  Diferenças podem ocorrer em razão do recorte de respondentes, período da coleta, mudanças
                  organizacionais e percepção coletiva no momento da aplicação.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="apuracao" className="space-y-6">
          <ApuracaoTabela titulo="GERAL" linhas={apuracaoGeral} />
          {apuracaoSetores.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-6">
                <h2 className="text-lg font-semibold tracking-tight">Apuração por GES / Setores</h2>
                {apuracaoSetores.map((s) => {
                  const linhasSetor = DIMENSIONS.map((d) => {
                    const score = s.porDim.find((x) => x.dimId === d.id)?.score ?? 0;
                    const sev = SEVERIDADE_DIM[d.id] ?? 3;
                    const prob = probFromScorePct(score);
                    return { dim: d, score, prob, sev, risco: classifyRisco(prob, sev), n: s.n };
                  });
                  return (
                    <div key={s.setor}>
                      <div className="flex items-baseline justify-between mb-2">
                        <h3 className="font-bold text-primary uppercase tracking-wide text-sm">{s.setor}</h3>
                        <span className="text-xs text-muted-foreground">{s.n} resposta(s)</span>
                      </div>
                      <ApuracaoTabelaInner linhas={linhasSetor} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="respostas">
          <RespostasTab respostas={filtradas} colorMap={colorMap} />
        </TabsContent>

        <TabsContent value="aep">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">AEP Premium</h2>
              <p className="text-sm text-muted-foreground">
                Avaliação Ergonômica Preliminar consolidada por GES, com gráficos, plano de ação e anexos.
                Use o botão <strong>Exportar AEP Premium</strong> no topo da página para gerar o PDF.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>Empresa selecionada: <strong className="text-foreground">{empresaNome}</strong></li>
                <li>Respostas no recorte: <strong className="text-foreground tabular-nums">{filtradas.length}</strong></li>
                <li>GES avaliados (recorte): <strong className="text-foreground tabular-nums">{apuracaoSetores.length}</strong></li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pgr">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">Inventário PGR</h2>
              <p className="text-sm text-muted-foreground">
                Inventário de Riscos Psicossociais conforme NR-01, com classificação automática por nível de risco PGR.
              </p>
              <Button
                variant="primary"
                disabled={empresaSel === ALL || filtradas.length === 0}
                onClick={() => {
                  const emp = empresas.find((e) => e.codigo === empresaSel);
                  if (!emp) {
                    toast.error("Selecione uma empresa específica.");
                    return;
                  }
                  try {
                    gerarPgrPdf(emp as any, filtradas);
                    toast.success("Inventário PGR gerado.");
                  } catch (err) {
                    toast.error(`Falha ao gerar PGR: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}
              >
                <Download className="h-4 w-4" /> Exportar Inventário PGR
              </Button>
              {empresaSel === ALL && (
                <p className="text-xs text-warning-foreground">
                  Selecione uma empresa específica para habilitar a exportação.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plano" className="space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">Plano de ações</h2>
          </div>
          <PlanoTab linhas={apuracaoSetores} />
        </TabsContent>
      </Tabs>

      {/* Versão imprimível: tudo aberto */}
      <div className="hidden print:block space-y-4">
        <h1 className="text-2xl font-bold">Apuração dos Resultados</h1>
        <p className="text-sm">Empresa: <strong>{empresaNome}</strong> • Setor: <strong>{setorSel === ALL ? "Todos" : setorSel}</strong> • Respostas: <strong>{filtradas.length}</strong></p>
        <ApuracaoTabela titulo="GERAL" linhas={apuracaoGeral} />
        {apuracaoSetores.map((s) => {
          const linhasSetor = DIMENSIONS.map((d) => {
            const score = s.porDim.find((x) => x.dimId === d.id)?.score ?? 0;
            const sev = SEVERIDADE_DIM[d.id] ?? 3;
            const prob = probFromScorePct(score);
            return { dim: d, score, prob, sev, risco: classifyRisco(prob, sev), n: s.n };
          });
          return (
            <div key={s.setor}>
              <h3 className="font-bold text-primary uppercase tracking-wide text-sm mt-4">{s.setor}</h3>
              <ApuracaoTabelaInner linhas={linhasSetor} />
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ApuracaoTabela({ titulo, linhas }: { titulo: string; linhas: ApuLinha[] }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <h3 className="font-bold text-primary uppercase tracking-wide text-sm mb-3">{titulo}</h3>
        <ApuracaoTabelaInner linhas={linhas} />
      </CardContent>
    </Card>
  );
}

function ApuracaoTabelaInner({ linhas }: { linhas: ApuLinha[] }) {
  if (linhas.every((l) => l.n === 0)) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sem respostas no recorte.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <Th className="w-[18%]">DOMÍNIO</Th>
            <Th className="w-[7%] text-center">%</Th>
            <Th className="w-[20%]">AGENTE NOCIVO</Th>
            <Th className="w-[22%]">POSSÍVEIS DANOS</Th>
            <Th className="w-[10%] text-center">PROBABILIDADE<div className="text-[10px] font-normal opacity-80">(1 a 5)</div></Th>
            <Th className="w-[10%] text-center">SEVERIDADE<div className="text-[10px] font-normal opacity-80">(1 a 5)</div></Th>
            <Th className="w-[13%] text-center">NÍVEL DE RISCO</Th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const meta = DIM_META[l.dim.id] ?? { agente: l.dim.description, danos: "—" };
            const pctCls =
              l.score >= 70 ? "bg-destructive/15 text-destructive"
              : l.score >= 50 ? "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300"
              : l.score >= 30 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
            return (
              <tr key={l.dim.id} className="border-t align-top">
                <Td className="font-medium">{l.dim.title}</Td>
                <Td className="text-center">
                  <span className={`inline-block px-2 py-1 rounded font-bold tabular-nums ${pctCls}`}>
                    {l.score}%
                  </span>
                </Td>
                <Td className="text-muted-foreground">{meta.agente}</Td>
                <Td className="text-muted-foreground">{meta.danos}</Td>
                <Td className="text-center font-bold tabular-nums">{l.prob}</Td>
                <Td className="text-center font-bold tabular-nums">{l.sev}</Td>
                <Td className="text-center">
                  <span className={`inline-block px-3 py-1 rounded font-bold text-xs uppercase tracking-wide ${l.risco.soft}`}>
                    {l.risco.label}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left text-xs font-bold uppercase tracking-wide px-3 py-2.5 ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-3 text-sm ${className}`}>{children}</td>;
}

function RespostasTab({ respostas, colorMap }: { respostas: Resposta[]; colorMap: Record<string, string> }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Cargo</TableHead>
                {DIMENSIONS.map((d) => <TableHead key={d.id} className="text-center text-xs">{d.title.split(" ")[0]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {respostas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.nomeEmpresa}</TableCell>
                  <TableCell className="text-sm">{r.setor || "—"}</TableCell>
                  <TableCell className="text-sm">{r.cargo || "—"}</TableCell>
                  {DIMENSIONS.map((d) => {
                    const s = dimensionRiskScore(d, r.answers);
                    const { color, label } = riskLabel(s);
                    return (
                      <TableCell key={d.id} className="text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${colorMap[color]}`} title={label}>
                          {s}
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {respostas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3 + DIMENSIONS.length} className="text-center text-muted-foreground py-8">
                    Sem respostas no recorte selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanoTab({ linhas }: { linhas: LinhaSetor[] }) {
  if (linhas.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Sem respostas para gerar plano de ações.</CardContent></Card>
    );
  }
  return (
    <div className="space-y-4">
      {linhas.map((p) => {
        const dims = p.porDim.filter((d) => d.sev !== "baixo");
        return (
          <Card key={p.setor}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{p.setor}</h2>
                  <p className="text-xs text-muted-foreground">{p.n} resposta(s) considerada(s)</p>
                </div>
              </div>
              {dims.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Nenhuma dimensão acima de "Baixo" neste setor.</p>
              ) : (
                <Accordion type="multiple" className="mt-4">
                  {dims.map((d) => {
                    const acoes = getRecomendacoes(d.dimId, d.score);
                    return (
                      <AccordionItem key={d.dimId} value={d.dimId}>
                        <AccordionTrigger>
                          <div className="flex items-center justify-between flex-1 pr-3">
                            <span className="text-left font-medium">{d.dimTitle}</span>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground tabular-nums">{d.score}%</span>
                              <span className={`px-2 py-0.5 rounded-full font-medium ${sevColor[d.sev]}`}>
                                {sevLabel[d.sev]}
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {acoes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sem ações específicas. Manter monitoramento periódico.</p>
                          ) : (
                            <ul className="space-y-3">
                              {acoes.map((a, i) => (
                                <li key={i} className="rounded-md border bg-card p-3">
                                  <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex items-start gap-2">
                                      <ClipboardList className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                      <div>
                                        <div className="font-medium text-sm">{a.titulo}</div>
                                        <p className="text-sm text-muted-foreground mt-0.5">{a.detalhe}</p>
                                      </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1 text-xs rounded bg-secondary px-2 py-0.5 whitespace-nowrap">
                                      <AlertTriangle className="h-3 w-3" /> {a.prazo}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

