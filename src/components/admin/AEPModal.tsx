import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, FileText, FileSpreadsheet, Loader2, FileWarning, CheckCircle2, XCircle } from "lucide-react";
import { listEmpresas, listRespostas, type Resposta } from "@/lib/storage";
import { getEmpresa, updateEmpresa } from "@/lib/empresas";
import { listCampanhas, type CampanhaComEmpresa } from "@/lib/campanhas";
import { buildAepDataset, respostasSemFuncao, validarSetorGes, gesMapKey, formatGes, MSG_RELATORIO_GES_BLOQUEADO, type GesMap } from "@/lib/exports/aep-data";
import { carregarGesCadastradosDoModuloSetores } from "@/lib/exports/aep-ges-client";
import { gerarRelatorioAEPpdf } from "@/lib/exports/aep-pdf";
import { gerarRelatorioAEPdocx } from "@/lib/exports/aep-docx";
import { exportRespostasXlsx } from "@/lib/excel-export";
import { getCurrentAccountInfo } from "@/lib/account";
import { dimensoesDaVersao } from "@/lib/copsoq";
import { CorrigirFuncoesDialog } from "./CorrigirFuncoesDialog";
import { AEPErrorDialog, type AEPErrorInfo } from "./AEPErrorDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";


const ALL = "__all__";

const JUSTIF_OPCOES = [
  "Sem trabalhadores ativos no período",
  "Setor não estava em operação",
  "Não houve adesão mínima",
  "Avaliação programada para próxima etapa",
  "Ausência justificada pela empresa",
  "Outro",
];

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

type RespTec = { nome: string; formacao: string; registro: string; cargo: string };

const respKey = (cod: string) => `aep:resp:${cod || "_all_"}`;
const justKey = (cod: string) => `aep:justif:${cod || "_all_"}`;

export function AEPModal({ open, onOpenChange }: Props) {
  const [empresas, setEmpresas] = useState<Awaited<ReturnType<typeof listEmpresas>>>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaComEmpresa[]>([]);
  const [gesMap, setGesMap] = useState<GesMap>({});
  const [gesRowsState, setGesRowsState] = useState<Array<{ codigoEmpresa: string; setor: string; ges: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "pdf" | "docx" | "xlsx" | "rascunho">(null);

  const [empresaSel, setEmpresaSel] = useState<string>(ALL);
  const [setorSel, setSetorSel] = useState<string>(ALL);
  const [campanhaSel, setCampanhaSel] = useState<string>(ALL);
  const [inicio, setInicio] = useState<string>("");
  const [fim, setFim] = useState<string>("");
  const [graficos, setGraficos] = useState(true);
  const [planoAcao, setPlanoAcao] = useState(true);
  const [anexos, setAnexos] = useState(true);
  const [somenteAvaliados, setSomenteAvaliados] = useState(true);
  const [corrigirOpen, setCorrigirOpen] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; info: AEPErrorInfo | null }>({ open: false, info: null });
  const agruparPorGes = true;


  // Responsável técnico (4 campos obrigatórios)
  const [resp, setResp] = useState<RespTec>({ nome: "", formacao: "", registro: "", cargo: "" });

  // Dados técnicos da empresa (quick-fill)
  const [cnae, setCnae] = useState("");
  const [grauRisco, setGrauRisco] = useState("");
  const [numTrabalhadores, setNumTrabalhadores] = useState("");
  const [trabAbrangidos, setTrabAbrangidos] = useState("");

  // Justificativas { "GES 14": "texto" }
  const [justifs, setJustifs] = useState<Record<string, string>>({});
  const [justifsCustom, setJustifsCustom] = useState<Record<string, string>>({});

  const reload = async () => {
    const info = await getCurrentAccountInfo();
    const ownerOnly = info?.accountType === "consultor";
    const [e, r, c] = await Promise.all([
      listEmpresas(ownerOnly ? { ownerOnly: true } : undefined),
      listRespostas(),
      listCampanhas(ownerOnly ? { ownerOnly: true } : undefined),
    ]);
    setEmpresas(e); setRespostas(r); setCampanhas(c);

    const ges = await carregarGesCadastradosDoModuloSetores(e);
    setGesMap(ges.gesMap);
    setGesRowsState(ges.rows);
  };

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try { await reload(); } finally { setLoading(false); }
    })();
  }, [open]);

  // Auto-fill ao trocar empresa
  useEffect(() => {
    if (empresaSel === ALL) {
      setCnae(""); setGrauRisco(""); setNumTrabalhadores(""); setTrabAbrangidos("");
      // Restaura último responsável genérico
      try {
        const saved = localStorage.getItem(respKey(""));
        if (saved) setResp(JSON.parse(saved));
      } catch {}
      setJustifs({}); setJustifsCustom({});
      return;
    }
    (async () => {
      const emp = await getEmpresa(empresaSel);
      if (emp) {
        setCnae((emp as any).cnae ?? "");
        setGrauRisco((emp as any).grau_risco ?? "");
        setNumTrabalhadores((emp as any).num_trabalhadores != null ? String((emp as any).num_trabalhadores) : "");
        try {
          const saved = localStorage.getItem(respKey(empresaSel));
          if (saved) setResp(JSON.parse(saved));
          else setResp({
            nome: emp.responsavel_nome ?? "",
            formacao: (emp as any).resp_formacao ?? "",
            registro: (emp as any).resp_registro ?? "",
            cargo: emp.responsavel_cargo ?? "",
          });
        } catch {}
        try {
          const sj = localStorage.getItem(justKey(empresaSel));
          if (sj) {
            const parsed = JSON.parse(sj);
            setJustifs(parsed.justifs ?? {});
            setJustifsCustom(parsed.custom ?? {});
          } else { setJustifs({}); setJustifsCustom({}); }
        } catch {}
      }
    })();
  }, [empresaSel]);

  const respostasFiltradas = useMemo(() => respostas.filter((r) =>
    (empresaSel === ALL || r.codigoEmpresa === empresaSel) &&
    (setorSel === ALL || (r.setor || "(sem setor)") === setorSel) &&
    (campanhaSel === ALL || r.campanhaId === campanhaSel) &&
    (!inicio || r.criadoEm >= inicio) &&
    (!fim || r.criadoEm <= fim + "T23:59:59"),
  ), [respostas, empresaSel, setorSel, campanhaSel, inicio, fim]);

  const setoresDisp = useMemo(() => {
    const set = new Set<string>();
    respostas.forEach((r) => {
      if (empresaSel !== ALL && r.codigoEmpresa !== empresaSel) return;
      set.add(r.setor || "(sem setor)");
    });
    return [...set].sort();
  }, [respostas, empresaSel]);

  const campanhasDisp = useMemo(
    () => empresaSel === ALL ? campanhas : campanhas.filter((c) => c.empresa_codigo === empresaSel),
    [campanhas, empresaSel],
  );

  const empresaNome = empresaSel === ALL
    ? "Todas as empresas"
    : empresas.find((e) => e.codigo === empresaSel)?.nome ?? empresaSel;

  // GES da empresa atual filtrada
  const gesRowsEmp = useMemo(() => {
    if (empresaSel === ALL) return gesRowsState;
    return gesRowsState.filter((r) => (r.codigoEmpresa || "").toLowerCase() === empresaSel.toLowerCase());
  }, [gesRowsState, empresaSel]);

  // Lista de GES sem avaliação para esta empresa (para coletar justificativas)
  const gesSemAvalLista = useMemo(() => {
    const setoresAvaliados = new Set<string>();
    respostasFiltradas.forEach((r) => {
      const s = r.setor?.trim(); if (!s) return;
      setoresAvaliados.add(gesMapKey((r.codigoEmpresa ?? "").trim(), s));
    });
    const agg = new Map<string, { gesFmt: string; setores: string[]; avaliado: boolean }>();
    gesRowsEmp.forEach((row) => {
      const ges = row.ges?.trim(); const setor = row.setor?.trim();
      if (!ges || !setor) return;
      const fmt = formatGes(ges);
      const cur = agg.get(fmt) ?? { gesFmt: fmt, setores: [], avaliado: false };
      if (!cur.setores.includes(setor)) cur.setores.push(setor);
      if (setoresAvaliados.has(gesMapKey((row.codigoEmpresa ?? "").trim(), setor))) cur.avaliado = true;
      agg.set(fmt, cur);
    });
    return [...agg.values()].filter((g) => !g.avaliado).sort((a, b) => a.gesFmt.localeCompare(b.gesFmt));
  }, [gesRowsEmp, respostasFiltradas]);

  const pendentesFuncao = useMemo(
    () => respostasSemFuncao(respostasFiltradas),
    [respostasFiltradas],
  );
  const setoresPendentes = useMemo(
    () => [...new Set(pendentesFuncao.map((r) => r.setor.trim().toUpperCase()))].join(", "),
    [pendentesFuncao],
  );

  const validacaoGes = useMemo(
    () => validarSetorGes(respostasFiltradas, gesMap),
    [respostasFiltradas, gesMap],
  );

  // Checklist de validação técnica
  const checklist = useMemo(() => {
    const items: { label: string; ok: boolean; }[] = [];
    items.push({ label: "CNAE preenchido", ok: !!cnae.trim() });
    items.push({ label: "Grau de Risco preenchido", ok: !!grauRisco.trim() });
    items.push({ label: "Responsável técnico — nome", ok: !!resp.nome.trim() });
    items.push({ label: "Responsável técnico — formação", ok: !!resp.formacao.trim() });
    items.push({ label: "Responsável técnico — registro profissional", ok: !!resp.registro.trim() });
    items.push({ label: "Total de GES cadastrados > 0", ok: gesRowsEmp.length > 0 });
    items.push({ label: "Sem setores com GES ausente", ok: validacaoGes.semGes.length === 0 });
    const todasJustOk = gesSemAvalLista.every((g) => {
      const v = justifs[g.gesFmt];
      if (!v) return false;
      if (v === "Outro") return !!(justifsCustom[g.gesFmt] || "").trim();
      return true;
    });
    // Quando o relatório inclui APENAS GES avaliados, as justificativas não vão para o PDF
    // e portanto não bloqueiam a emissão final.
    items.push({
      label: somenteAvaliados ? "GES sem avaliação (não exibidos no PDF)" : "GES sem avaliação com justificativa",
      ok: somenteAvaliados || gesSemAvalLista.length === 0 || todasJustOk,
    });
    items.push({ label: "Avaliações com função vinculada", ok: pendentesFuncao.length === 0 });
    return items;
  }, [cnae, grauRisco, resp, gesRowsEmp.length, validacaoGes.semGes.length, gesSemAvalLista, justifs, justifsCustom, pendentesFuncao.length, somenteAvaliados]);

  const todosOk = checklist.every((c) => c.ok);

  const buildData = async (rascunho: boolean) => {
    const { loadDimensions } = await import("@/lib/copsoq");
    await loadDimensions(true);
    const empresa = empresaSel === ALL ? null : await getEmpresa(empresaSel);
    const gesAtual = await carregarGesCadastradosDoModuloSetores(empresas, empresaSel === ALL ? undefined : empresaSel);
    const gesRows = gesAtual.rows;
    if (gesRows.length === 0) throw new Error("Erro: não foi possível buscar os GES cadastrados da empresa. Verifique a consulta da tabela de setores.");
    if (Object.keys(gesAtual.gesMap).length > 0) setGesMap(gesAtual.gesMap);

    // Monta dicionário de justificativas (resolve "Outro")
    const justifsFinal: Record<string, string> = {};
    Object.entries(justifs).forEach(([k, v]) => {
      if (!v) return;
      if (v === "Outro") {
        const c = (justifsCustom[k] || "").trim();
        if (c) justifsFinal[k] = c;
      } else {
        justifsFinal[k] = v;
      }
    });

    // Pontua contra a estrutura da versão em que as respostas foram dadas, não
    // contra a vigente. Trocado o instrumento, os códigos gravados em `answers`
    // deixam de existir na versão nova e todos os escores zerariam em silêncio.
    const versaoDoRecorte = respostasFiltradas.find((r) => r.versaoId)?.versaoId ?? null;
    const dimensoesDoRecorte = versaoDoRecorte
      ? await dimensoesDaVersao(versaoDoRecorte)
      : undefined;

    return buildAepDataset({
      dimensoes: dimensoesDoRecorte,
      empresa,
      empresaNome,
      setorFiltro: setorSel === ALL ? "Todos" : setorSel,
      campanhaNome: campanhaSel === ALL ? "Todas" : (campanhas.find((c) => c.id === campanhaSel)?.nome ?? "Todas"),
      periodo: { inicio: inicio || undefined, fim: fim || undefined },
      responsavelTecnico: resp.nome.trim() || (empresa as any)?.responsavel_nome || "Responsável técnico (preencher)",
      responsavelTec: {
        nome: resp.nome.trim(),
        formacao: resp.formacao.trim(),
        registro: resp.registro.trim(),
        cargo: resp.cargo.trim(),
        dataEmissao: new Date().toLocaleDateString("pt-BR"),
      },
      respostas: respostasFiltradas,
      gesPorSetor: Object.keys(gesAtual.gesMap).length > 0 ? gesAtual.gesMap : gesMap,
      agruparPorGes: true,
      gesCadastrados: gesRows,
      justificativasSemAvaliacao: justifsFinal,
      totalTrabalhadoresCadastrados: numTrabalhadores.trim() ? Number(numTrabalhadores) : undefined,
      totalTrabalhadoresAbrangidos: trabAbrangidos.trim() ? Number(trabAbrangidos) : undefined,
      rascunho,
    });
  };

  const persistRespEmpresa = async () => {
    if (empresaSel === ALL) return;
    try { localStorage.setItem(respKey(empresaSel), JSON.stringify(resp)); } catch {}
    try {
      localStorage.setItem(justKey(empresaSel), JSON.stringify({ justifs, custom: justifsCustom }));
    } catch {}
    // Atualiza dados na empresa
    try {
      await updateEmpresa(empresaSel, {
        cnae: cnae.trim() || null,
        grau_risco: grauRisco.trim() || null,
        num_trabalhadores: numTrabalhadores.trim() ? Number(numTrabalhadores) : null,
        responsavel_nome: resp.nome.trim() || null,
        responsavel_cargo: resp.cargo.trim() || null,
        resp_formacao: resp.formacao.trim() || null,
        resp_registro: resp.registro.trim() || null,
      } as any);
    } catch {}
  };

  const guardFinal = (): boolean => {
    const long = { duration: 10000 } as const;
    if (respostasFiltradas.length === 0) { toast.error("Sem respostas no recorte selecionado.", long); return false; }
    if (pendentesFuncao.length > 0) {
      toast.error(`O setor ${setoresPendentes} possui avaliação sem função vinculada.`, long);
      return false;
    }
    if (validacaoGes.semGes.length > 0) {
      toast.error(MSG_RELATORIO_GES_BLOQUEADO, long);
      return false;
    }
    if (!cnae.trim() || !grauRisco.trim()) {
      toast.error("Relatório bloqueado: CNAE e Grau de Risco são obrigatórios para emissão do relatório técnico.", long);
      return false;
    }
    if (!resp.nome.trim() || !resp.formacao.trim() || !resp.registro.trim()) {
      toast.error("Relatório bloqueado: informe o responsável técnico, formação e registro profissional.", long);
      return false;
    }
    if (!somenteAvaliados) {
      const semJust = gesSemAvalLista.filter((g) => {
        const v = justifs[g.gesFmt];
        if (!v) return true;
        if (v === "Outro") return !(justifsCustom[g.gesFmt] || "").trim();
        return false;
      });
      if (semJust.length > 0) {
        toast.error(`Relatório bloqueado: ${semJust.length} GES sem avaliação ainda sem justificativa.`, long);
        return false;
      }
    }
    return true;
  };

  const gerarPdf = async (rascunho: boolean) => {
    console.log("[AEP-PDF] click gerarPdf", { rascunho, empresaSel, respostas: respostasFiltradas.length });
    if (!rascunho && !guardFinal()) { console.warn("[AEP-PDF] bloqueado por guardFinal"); return; }
    if (respostasFiltradas.length === 0) { toast.error("Sem respostas no recorte selecionado.", { duration: 10000 }); return; }
    setBusy(rascunho ? "rascunho" : "pdf");

    let etapaAtual = "iniciando";
    let datasetInfo = { aval: undefined as number | undefined, sem: undefined as number | undefined };
    const campanhaNome = campanhaSel === ALL ? "Todas" : (campanhas.find((c) => c.id === campanhaSel)?.nome ?? campanhaSel);

    try {
      etapaAtual = "persistir dados da empresa";
      console.log("[AEP-PDF]", etapaAtual);
      await persistRespEmpresa();

      etapaAtual = "montar dataset (buildData)";
      console.log("[AEP-PDF]", etapaAtual);
      const data = await buildData(rascunho);
      datasetInfo = { aval: data.gesAvaliados.length, sem: data.gesSemAvaliacao.length };
      console.log("[AEP-PDF] dataset pronto", { ges: data.gesCadastrados.length, ...datasetInfo });
      toast.success(`GES cadastrados: ${data.gesCadastrados.length} • avaliados: ${data.gesAvaliados.length} • sem avaliação: ${data.gesSemAvaliacao.length}${rascunho ? " • RASCUNHO" : ""}`);

      etapaAtual = "gerar PDF (jsPDF)";
      console.log("[AEP-PDF]", etapaAtual);
      const controlesMap = data.empresa
        ? await (await import("@/lib/control-measures")).carregarControlesExistentes(data.empresa.id)
        : undefined;
      await gerarRelatorioAEPpdf(data, {
        incluirGraficos: graficos,
        incluirPlanoAcao: planoAcao,
        incluirAnexos: anexos,
        somenteAvaliados,
        throwOnError: true,
        controlesMap: controlesMap as any,
        onStep: (s) => { etapaAtual = s; },
      });
      console.log("[AEP-PDF] concluído");
    } catch (e: any) {
      console.error("[AEP-PDF] erro na etapa:", etapaAtual, e);
      const err = e instanceof Error ? e : new Error(String(e));
      const info: AEPErrorInfo = {
        etapa: etapaAtual,
        empresaCodigo: empresaSel === ALL ? "" : empresaSel,
        empresaNome,
        campanha: campanhaNome,
        setor: setorSel === ALL ? "Todos" : setorSel,
        periodoInicio: inicio || undefined,
        periodoFim: fim || undefined,
        qtdRespostas: respostasFiltradas.length,
        qtdGesCadastrados: gesRowsEmp.length,
        qtdGesAvaliados: datasetInfo.aval,
        qtdGesSemAvaliacao: datasetInfo.sem,
        somenteAvaliados,
        rascunho,
        errorName: err.name || "Error",
        errorMessage: err.message || String(e),
        errorCode: (e as any)?.code ?? (e as any)?.error_code ?? undefined,
        errorStatus: (e as any)?.status ?? (e as any)?.statusCode ?? (e as any)?.response?.status ?? undefined,
        apiResponse: (() => {
          const r = (e as any)?.response ?? (e as any)?.data ?? (e as any)?.body;
          if (r == null) return undefined;
          try { return typeof r === "string" ? r : JSON.stringify(r, null, 2); } catch { return String(r); }
        })(),
        stack: err.stack,
        ambiente: typeof window !== "undefined" ? `${window.location.host} · ${navigator.userAgent}` : "n/d",
        timestamp: new Date().toISOString(),
      };
      toast.error(`Falha ao gerar PDF na etapa: ${etapaAtual}`, { duration: 8000 });
      setErrorDialog({ open: true, info });
    }
    finally { setBusy(null); }
  };



  const onDocx = async () => {
    if (!guardFinal()) return;
    setBusy("docx");
    try {
      await persistRespEmpresa();
      const data = await buildData(false);
      await gerarRelatorioAEPdocx(data);
    } catch (e: any) { toast.error(e?.message ?? "Falha ao gerar Word."); }
    finally { setBusy(null); }
  };

  const onXlsx = () => {
    if (respostasFiltradas.length === 0) { toast.error("Sem respostas no recorte selecionado."); return; }
    setBusy("xlsx");
    try { exportRespostasXlsx(respostasFiltradas, `AEP-base-${new Date().toISOString().slice(0, 10)}.xlsx`); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Relatório AEP Premium</DialogTitle>
          <DialogDescription>
            Avaliação Ergonômica Preliminar — Riscos Psicossociais (NR-01 / GRO / PGR)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando dados...</div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
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
                <Label>GES / Setores</Label>
                <Select value={setorSel} onValueChange={setSetorSel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {setoresDisp.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Campanha</Label>
                <Select value={campanhaSel} onValueChange={setCampanhaSel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {campanhasDisp.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Dados técnicos da empresa */}
            <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
              <p className="text-sm font-semibold">Dados técnicos da empresa <span className="text-destructive">*</span></p>
              <div className="grid sm:grid-cols-3 gap-2">
                <div>
                  <Label>CNAE *</Label>
                  <Input value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder="00.00-0/00" />
                </div>
                <div>
                  <Label>Grau de Risco *</Label>
                  <Input value={grauRisco} onChange={(e) => setGrauRisco(e.target.value)} placeholder="1 a 4" />
                </div>
                <div>
                  <Label>Trab. cadastrados</Label>
                  <Input type="number" min={0} value={numTrabalhadores} onChange={(e) => setNumTrabalhadores(e.target.value)} placeholder="Ex.: 120" />
                </div>
                <div className="sm:col-span-3">
                  <Label>Trab. abrangidos pelos GES avaliados (opcional)</Label>
                  <Input type="number" min={0} value={trabAbrangidos} onChange={(e) => setTrabAbrangidos(e.target.value)} placeholder="Se diferente do nº de respostas" />
                </div>
              </div>
            </div>

            {/* Responsável técnico */}
            <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
              <p className="text-sm font-semibold">Responsável Técnico <span className="text-destructive">*</span></p>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label>Nome completo *</Label>
                  <Input value={resp.nome} onChange={(e) => setResp({ ...resp, nome: e.target.value })} />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input value={resp.cargo} onChange={(e) => setResp({ ...resp, cargo: e.target.value })} placeholder="Ex.: Eng. Segurança do Trabalho" />
                </div>
                <div>
                  <Label>Formação *</Label>
                  <Input value={resp.formacao} onChange={(e) => setResp({ ...resp, formacao: e.target.value })} placeholder="Eng. Segurança / Psicólogo / Téc. Segurança" />
                </div>
                <div>
                  <Label>Registro profissional *</Label>
                  <Input value={resp.registro} onChange={(e) => setResp({ ...resp, registro: e.target.value })} placeholder="CREA / CRP / CRT / CRM" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Renderizado no PDF (capa, dados da empresa e bloco de assinatura).
              </p>
            </div>

            <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
              <p className="text-sm font-semibold">Modo do relatório</p>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <label className="flex items-start gap-2 cursor-pointer rounded border p-2 hover:bg-background">
                  <input
                    type="radio"
                    name="aep-modo"
                    className="mt-1"
                    checked={somenteAvaliados}
                    onChange={() => setSomenteAvaliados(true)}
                  />
                  <span>
                    <strong>Somente GES avaliados</strong> (padrão)
                    <span className="block text-xs text-muted-foreground">
                      Recomendado para fiscalização — não expõe pendências internas.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer rounded border p-2 hover:bg-background">
                  <input
                    type="radio"
                    name="aep-modo"
                    className="mt-1"
                    checked={!somenteAvaliados}
                    onChange={() => setSomenteAvaliados(false)}
                  />
                  <span>
                    <strong>Todos os GES cadastrados</strong>
                    <span className="block text-xs text-muted-foreground">
                      Inclui GES sem avaliação com justificativa (uso interno).
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-2 rounded-lg border p-3 bg-muted/30">
              <Toggle label="Incluir gráficos" v={graficos} on={setGraficos} />
              <Toggle label="Incluir plano de ação" v={planoAcao} on={setPlanoAcao} />
              <Toggle label="Incluir anexos" v={anexos} on={setAnexos} />
            </div>

            {/* Justificativas dos GES sem avaliação — só quando o relatório vai incluí-los */}
            {!somenteAvaliados && gesSemAvalLista.length > 0 && (
              <Accordion type="single" collapsible defaultValue="just">
                <AccordionItem value="just">
                  <AccordionTrigger>
                    Justificativa dos GES sem avaliação ({gesSemAvalLista.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {gesSemAvalLista.map((g) => (
                        <div key={g.gesFmt} className="rounded border p-2">
                          <div className="text-sm font-medium">
                            {g.gesFmt} — <span className="text-muted-foreground">{g.setores.join(" / ")}</span>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2 mt-2">
                            <Select
                              value={justifs[g.gesFmt] ?? ""}
                              onValueChange={(v) => setJustifs((p) => ({ ...p, [g.gesFmt]: v }))}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione a justificativa" /></SelectTrigger>
                              <SelectContent>
                                {JUSTIF_OPCOES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {justifs[g.gesFmt] === "Outro" && (
                              <Input
                                value={justifsCustom[g.gesFmt] ?? ""}
                                onChange={(e) => setJustifsCustom((p) => ({ ...p, [g.gesFmt]: e.target.value }))}
                                placeholder="Descreva a justificativa"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {pendentesFuncao.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Avaliações sem função vinculada</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    O setor <strong>{setoresPendentes}</strong> possui {pendentesFuncao.length} avaliação(ões) sem função vinculada.
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => setCorrigirOpen(true)}>
                    Corrigir função agora
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {validacaoGes.semGes.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Setores sem GES cadastrado</AlertTitle>
                <AlertDescription>
                  Cadastre o GES dos setores: <strong>
                    {validacaoGes.semGes.slice(0, 8).map((x) => x.setor).join(", ")}
                    {validacaoGes.semGes.length > 8 ? "…" : ""}
                  </strong>
                </AlertDescription>
              </Alert>
            )}

            {/* Validação Técnica para Fiscalização */}
            <div className="rounded-lg border p-3 bg-primary/5">
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Validação Técnica para Fiscalização
              </p>
              <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.ok
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <span className={c.ok ? "" : "text-destructive"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {!todosOk && (
                <p className="text-xs text-destructive mt-2">
                  Relatório bloqueado para emissão final. Use “Gerar prévia (rascunho)” para revisão interna.
                </p>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground tabular-nums">{respostasFiltradas.length}</strong> resposta(s) no recorte • Empresa: <strong className="text-foreground">{empresaNome}</strong>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={onXlsx} disabled={!!busy}>
            {busy === "xlsx" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
            Excel
          </Button>
          <Button variant="outline" onClick={onDocx} disabled={!!busy || !todosOk}>
            {busy === "docx" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Word
          </Button>
          <Button variant="secondary" onClick={() => gerarPdf(true)} disabled={!!busy}>
            {busy === "rascunho" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileWarning className="h-4 w-4 mr-1" />}
            Gerar prévia (rascunho)
          </Button>
          <Button onClick={() => gerarPdf(false)} disabled={!!busy || !todosOk} title={!todosOk ? "Complete os itens da validação técnica" : undefined}>
            {busy === "pdf" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Gerar PDF Final
          </Button>
        </DialogFooter>
      </DialogContent>

      <CorrigirFuncoesDialog
        open={corrigirOpen}
        onOpenChange={setCorrigirOpen}
        pendentes={pendentesFuncao}
        onCorrigido={() => { void reload(); }}
      />

      <AEPErrorDialog
        open={errorDialog.open}
        onOpenChange={(v) => setErrorDialog((s) => ({ ...s, open: v }))}
        info={errorDialog.info}
      />
    </Dialog>

  );
}

function Toggle({ label, v, on, disabled = false }: { label: string; v: boolean; on: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm cursor-pointer">
      <span>{label}</span>
      <Switch checked={v} onCheckedChange={on} disabled={disabled} />
    </label>
  );
}
