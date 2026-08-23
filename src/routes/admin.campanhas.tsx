import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Copy, Power, PowerOff, Pencil, ExternalLink, CalendarRange, Sparkles, Search, BarChart3, AlertTriangle, FileBarChart2, Layers } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { listEmpresas, type Empresa } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import {
  listCampanhas, createCampanha, updateCampanha, deleteCampanha, statusVigencia,
  listCampaignSectorIds, analisarSetoresDaCampanha, getReavaliacaoStats,
  CAMPAIGN_TYPE_LABEL,
  type CampanhaComEmpresa, type CampaignType, type ScopeMode, type SetorAnalise, type ReavaliacaoStats,
} from "@/lib/campanhas";
import { toast } from "sonner";
import { buildQuestionarioUrl } from "@/lib/public-origin";

export const Route = createFileRoute("/admin/campanhas")({
  head: () => ({ meta: [{ title: "Campanhas | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: CampanhasPage,
});

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<CampanhaComEmpresa[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [openReaval, setOpenReaval] = useState(false);
  const [statsFor, setStatsFor] = useState<CampanhaComEmpresa | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const refresh = async () => {
    const info = await import("@/lib/account").then((m) => m.getCurrentAccountInfo());
    const ownerOnly = info?.accountType === "consultor";
    const [c, e] = await Promise.all([
      listCampanhas({ ownerOnly }),
      listEmpresas({ ownerOnly }),
    ]);
    setCampanhas(c);
    setEmpresas(e);
  };
  useEffect(() => { refresh(); }, []);

  const editing = useMemo(() => campanhas.find((c) => c.id === editId) ?? null, [editId, campanhas]);

  const remove = async (id: string) => {
    if (!confirm("Excluir esta campanha? Respostas existentes serão mantidas.")) return;
    try {
      await deleteCampanha(id);
      await refresh();
      toast.success("Campanha excluída");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir");
    }
  };

  const toggleAtiva = async (id: string, ativa: boolean) => {
    try {
      await updateCampanha(id, { ativa: !ativa });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro");
    }
  };

  const copy = (codigo: string) => {
    const url = buildQuestionarioUrl(codigo);
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  const campanhasPorId = useMemo(() => new Map(campanhas.map((c) => [c.id, c])), [campanhas]);

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Períodos de coleta de respostas com link próprio, vigência e escopo de setores/GES."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setOpenReaval(true)}>
              <Sparkles className="h-4 w-4 mr-1" /> Nova reavaliação setorial
            </Button>
            <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova campanha</Button>
          </div>
        }
      />

      <Card className="mt-2">
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Tipo / Escopo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanhas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-2">
                  <EmptyState
                    icon={CalendarRange}
                    title="Nenhuma campanha cadastrada"
                    description="Crie uma campanha para abrir o período de coleta de respostas."
                    action={<Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova campanha</Button>}
                  />
                </TableCell></TableRow>
              )}
              {campanhas.map((c) => {
                const st = statusVigencia(c);
                const badgeKind: StatusKind = st === "ativa" ? "ativo" : st === "agendada" ? "em-analise" : "inativo";
                const badgeLabel = st === "ativa" ? "Ativa" : st === "agendada" ? "Agendada" : "Encerrada";
                const parent = c.parent_campaign_id ? campanhasPorId.get(c.parent_campaign_id) : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.empresa_nome}</TableCell>
                    <TableCell>
                      <div>{c.nome}</div>
                      {parent && <div className="text-xs text-muted-foreground">↩ Reavaliação de: {parent.nome}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit">{CAMPAIGN_TYPE_LABEL[c.campaign_type]}</Badge>
                        {c.scope_mode === "selected_sectors" ? (
                          <div className="text-xs text-muted-foreground max-w-[240px]">
                            {(c.setores_escopo ?? []).length === 0
                              ? "Sem setores selecionados"
                              : (c.setores_escopo ?? []).map((s) => s.ges ? `${s.nome} (GES ${s.ges})` : s.nome).join(", ")}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Todos os setores</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-xs">{c.codigo}</code></TableCell>
                    <TableCell className="text-sm">
                      {new Date(c.inicio).toLocaleDateString("pt-BR")}
                      {" → "}
                      {c.fim ? new Date(c.fim).toLocaleDateString("pt-BR") : <span className="text-muted-foreground">sem fim</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={badgeKind} label={badgeLabel} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {c.campaign_type === "sector_reassessment" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setStatsFor(c)} title="Ver respostas da reavaliação">
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" asChild title="Gerar relatório da reavaliação (apenas GES reavaliados)">
                              <Link to="/admin/relatorio" search={{ empresa: c.empresa_codigo, campanha: c.id } as any}>
                                <FileBarChart2 className="h-4 w-4" />
                              </Link>
                            </Button>
                            {c.parent_campaign_id && (
                              <Button variant="ghost" size="sm" asChild title="Gerar consolidado atualizado (GES reavaliados usam respostas novas)">
                                <Link to="/admin/relatorio" search={{ empresa: c.empresa_codigo, campanha: c.parent_campaign_id } as any}>
                                  <Layers className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                          </>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => copy(c.codigo)} title="Copiar link"><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" asChild title="Abrir">
                          <a href={buildQuestionarioUrl(c.codigo)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleAtiva(c.id, c.ativa)} title={c.ativa ? "Desativar" : "Ativar"}>
                          {c.ativa ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditId(c.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(c.id)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CampanhaDialog
        open={openNew}
        onOpenChange={setOpenNew}
        empresas={empresas}
        campanhas={campanhas}
        onSaved={refresh}
      />
      <CampanhaDialog
        open={openReaval}
        onOpenChange={setOpenReaval}
        empresas={empresas}
        campanhas={campanhas}
        presetReavaliacao
        onSaved={refresh}
      />
      <CampanhaDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditId(null)}
        empresas={empresas}
        campanhas={campanhas}
        editing={editing}
        onSaved={refresh}
      />
      <ReavaliacaoStatsDialog campanha={statsFor} onClose={() => setStatsFor(null)} />
    </div>
  );
}

type SetorOption = { id: string; nome: string; ges: string | null };

function CampanhaDialog({
  open, onOpenChange, empresas, campanhas, editing, presetReavaliacao, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresas: Empresa[];
  campanhas: CampanhaComEmpresa[];
  editing?: CampanhaComEmpresa | null;
  presetReavaliacao?: boolean;
  onSaved: () => void;
}) {
  const [empresaId, setEmpresaId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [ativa, setAtiva] = useState(true);
  const [campaignType, setCampaignType] = useState<CampaignType>("general");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all_sectors");
  const [parentId, setParentId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [setores, setSetores] = useState<SetorOption[]>([]);
  const [selectedSetorIds, setSelectedSetorIds] = useState<Set<string>>(new Set());
  const [analise, setAnalise] = useState<Map<string, SetorAnalise>>(new Map());
  const [busca, setBusca] = useState("");
  const [loadingSetores, setLoadingSetores] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setEmpresaId(editing.empresa_id);
      setNome(editing.nome);
      setInicio(toLocalInput(editing.inicio));
      setFim(toLocalInput(editing.fim));
      setAtiva(editing.ativa);
      setCampaignType(editing.campaign_type);
      setScopeMode(editing.scope_mode);
      setParentId(editing.parent_campaign_id ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setEmpresaId("");
      const now = new Date();
      const off = now.getTimezoneOffset();
      setInicio(new Date(now.getTime() - off * 60_000).toISOString().slice(0, 16));
      setFim("");
      setAtiva(true);
      setParentId("");
      if (presetReavaliacao) {
        const dd = now.toLocaleDateString("pt-BR");
        setNome(`REAVALIAÇÃO SETORIAL — ${dd}`);
        setCampaignType("sector_reassessment");
        setScopeMode("selected_sectors");
        setNotes(
          "Reavaliação solicitada para confirmar os resultados de maior criticidade psicossocial identificados na avaliação anterior, considerando os setores/GES selecionados."
        );
      } else {
        setNome("");
        setCampaignType("general");
        setScopeMode("all_sectors");
        setNotes("");
      }
    }
    setBusca("");
    setSelectedSetorIds(new Set());
    setSetores([]);
    setAnalise(new Map());
  }, [open, editing, presetReavaliacao]);

  // Carrega setores da empresa selecionada
  useEffect(() => {
    if (!open || !empresaId) { setSetores([]); return; }
    (async () => {
      setLoadingSetores(true);
      const { data } = await supabase
        .from("empresa_setores")
        .select("id, nome, ges")
        .eq("empresa_id", empresaId)
        .eq("status", "active")
        .order("nome");
      setSetores(((data ?? []) as any[]).map((s) => ({ id: s.id, nome: s.nome, ges: s.ges ?? null })));
      setLoadingSetores(false);
    })();
  }, [open, empresaId]);

  // Ao editar campanha com escopo específico, carrega seleção atual
  useEffect(() => {
    if (!open || !editing) return;
    if (editing.scope_mode !== "selected_sectors") return;
    (async () => {
      const ids = await listCampaignSectorIds(editing.id);
      setSelectedSetorIds(new Set(ids));
    })();
  }, [open, editing]);

  // Carrega análise da campanha relacionada
  useEffect(() => {
    if (!open || !parentId) { setAnalise(new Map()); return; }
    (async () => {
      try {
        const rows = await analisarSetoresDaCampanha(parentId);
        const m = new Map<string, SetorAnalise>();
        rows.forEach((r) => m.set(r.setor.toLowerCase(), r));
        setAnalise(m);
      } catch { setAnalise(new Map()); }
    })();
  }, [open, parentId]);

  const parentOptions = useMemo(
    () => campanhas.filter((c) => c.empresa_id === empresaId && (!editing || c.id !== editing.id)),
    [campanhas, empresaId, editing],
  );

  const setoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return setores;
    return setores.filter((s) => s.nome.toLowerCase().includes(q) || (s.ges ?? "").toLowerCase().includes(q));
  }, [setores, busca]);

  const toggleSetor = (id: string) => {
    setSelectedSetorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selecionarCriticos = () => {
    if (!parentId) return toast.error("Escolha a campanha relacionada primeiro");
    if (analise.size === 0) return toast.info("A campanha relacionada não possui respostas para análise");
    const next = new Set(selectedSetorIds);
    let count = 0;
    setores.forEach((s) => {
      const a = analise.get(s.nome.toLowerCase());
      if (a && a.critico) { next.add(s.id); count++; }
    });
    setSelectedSetorIds(next);
    toast.success(count > 0 ? `${count} setor(es) crítico(s) selecionado(s)` : "Nenhum setor crítico encontrado na campanha anterior");
  };

  const limparSelecao = () => setSelectedSetorIds(new Set());

  const showParent = campaignType !== "general";
  const showScope = true; // sempre exibido

  const submit = async () => {
    if (!editing && !empresaId) return toast.error("Selecione a empresa");
    if (nome.trim().length < 2) return toast.error("Informe o nome da campanha");
    const inicioIso = fromLocalInput(inicio);
    const fimIso = fromLocalInput(fim);
    if (!inicioIso) return toast.error("Informe a data de início");
    if (fimIso && new Date(fimIso) <= new Date(inicioIso)) return toast.error("Fim deve ser depois do início");
    if (scopeMode === "selected_sectors" && selectedSetorIds.size === 0) {
      return toast.error("Selecione pelo menos 1 setor/GES para o escopo da campanha");
    }
    const setor_ids = scopeMode === "selected_sectors" ? Array.from(selectedSetorIds) : [];
    try {
      if (editing) {
        await updateCampanha(editing.id, {
          nome: nome.trim(),
          inicio: inicioIso,
          fim: fimIso,
          ativa,
          campaign_type: campaignType,
          scope_mode: scopeMode,
          parent_campaign_id: showParent && parentId ? parentId : null,
          notes: notes.trim() || null,
          setor_ids,
          empresa_id: editing.empresa_id,
        });
        toast.success("Campanha atualizada");
      } else {
        await createCampanha({
          empresa_id: empresaId,
          nome: nome.trim(),
          inicio: inicioIso,
          fim: fimIso,
          ativa,
          campaign_type: campaignType,
          scope_mode: scopeMode,
          parent_campaign_id: showParent && parentId ? parentId : null,
          notes: notes.trim() || null,
          setor_ids,
        });
        toast.success(
          scopeMode === "selected_sectors"
            ? "Campanha criada para os setores/GES selecionados"
            : "Campanha criada",
        );
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar campanha" : presetReavaliacao ? "Nova Reavaliação Setorial Complementar" : "Nova campanha"}</DialogTitle>
          <DialogDescription>
            Configure vigência, tipo e escopo. Para reavaliar só alguns setores/GES, escolha o escopo específico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 1. Dados básicos */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">1. Dados básicos</h3>
            <div>
              <Label>Empresa</Label>
              {editing ? (
                <Input value={editing.empresa_nome} disabled className="bg-muted" />
              ) : (
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} ({e.codigo})</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Nome da campanha</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} placeholder="Ex.: Reavaliação 2026 — Setores críticos" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Tipo da campanha</Label>
                <Select value={campaignType} onValueChange={(v) => setCampaignType(v as CampaignType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Avaliação geral da empresa</SelectItem>
                    <SelectItem value="sector_reassessment">Reavaliação de setores/GES específicos</SelectItem>
                    <SelectItem value="complementary">Avaliação complementar</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {campaignType === "general" && "Todos os setores/GES ativos poderão responder."}
                  {campaignType === "sector_reassessment" && "Apenas os setores/GES selecionados participarão."}
                  {campaignType === "complementary" && "Usada para completar respostas em setores específicos."}
                </p>
              </div>
              {showParent && (
                <div>
                  <Label>Campanha relacionada</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a campanha anterior..." /></SelectTrigger>
                    <SelectContent>
                      {parentOptions.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma campanha anterior desta empresa</div>}
                      {parentOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

          {/* 2. Vigência */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">2. Vigência</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fim (opcional)</Label>
                <Input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input id="ativa" type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
              <Label htmlFor="ativa" className="cursor-pointer">Campanha ativa</Label>
            </div>
          </section>

          {/* 3. Escopo */}
          {showScope && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">3. Escopo da campanha</h3>
              <RadioGroup value={scopeMode} onValueChange={(v) => setScopeMode(v as ScopeMode)} className="space-y-2">
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="all_sectors" id="scope-all" className="mt-1" />
                  <div>
                    <Label htmlFor="scope-all" className="cursor-pointer">Todos os setores/GES da empresa</Label>
                    <p className="text-xs text-muted-foreground">Qualquer setor cadastrado poderá responder.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="selected_sectors" id="scope-sel" className="mt-1" />
                  <div>
                    <Label htmlFor="scope-sel" className="cursor-pointer">Setores/GES específicos</Label>
                    <p className="text-xs text-muted-foreground">Somente os setores/GES abaixo participarão da campanha.</p>
                  </div>
                </div>
              </RadioGroup>

              {scopeMode === "selected_sectors" && (
                <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar setor ou GES..." className="pl-8" />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={selecionarCriticos} disabled={!parentId}>
                      <Sparkles className="h-4 w-4 mr-1" /> Selecionar setores críticos
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={limparSelecao}>Limpar</Button>
                  </div>

                  {!parentId && campaignType === "sector_reassessment" && (
                    <p className="text-xs text-muted-foreground">
                      Escolha a <strong>campanha relacionada</strong> acima para habilitar a seleção automática de setores críticos.
                    </p>
                  )}

                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {loadingSetores && <p className="text-sm text-muted-foreground p-2">Carregando setores...</p>}
                    {!loadingSetores && setoresFiltrados.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2">
                        {empresaId ? "Nenhum setor cadastrado para esta empresa." : "Selecione a empresa para listar setores."}
                      </p>
                    )}
                    {setoresFiltrados.map((s) => {
                      const a = analise.get(s.nome.toLowerCase());
                      const checked = selectedSetorIds.has(s.id);
                      return (
                        <label key={s.id} className={`flex items-center gap-3 p-2 rounded hover:bg-background cursor-pointer ${checked ? "bg-background" : ""}`}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleSetor(s.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {s.nome} {s.ges && <span className="text-muted-foreground">— GES {s.ges}</span>}
                            </div>
                            {a && (
                              <div className="text-xs text-muted-foreground">
                                {a.respostas} resposta(s) na campanha anterior
                                {a.label !== "—" && <> · <span className={
                                  a.label === "Crítico" ? "text-destructive font-medium"
                                  : a.label === "Alto" ? "text-orange-600 font-medium"
                                  : ""
                                }>{a.label}</span></>}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {selectedSetorIds.size} setor(es) selecionado(s).
                  </p>
                </div>
              )}
            </section>
          )}

          {/* 4. Observações */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">4. Observações internas</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Motivo da reavaliação, responsável pela solicitação, etc. (não aparece no link público)"
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>{editing ? "Salvar" : "Criar campanha"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReavaliacaoStatsDialog({ campanha, onClose }: { campanha: CampanhaComEmpresa | null; onClose: () => void }) {
  const [stats, setStats] = useState<ReavaliacaoStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campanha) { setStats(null); return; }
    setLoading(true);
    getReavaliacaoStats(campanha)
      .then(setStats)
      .catch((e) => toast.error(e?.message ?? "Erro ao carregar respostas"))
      .finally(() => setLoading(false));
  }, [campanha]);

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR") : "—";

  return (
    <Dialog open={!!campanha} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Respostas da reavaliação setorial</DialogTitle>
          <DialogDescription>
            Contagem restrita a esta campanha, dentro do escopo de setores/GES e após o início da vigência.
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {stats && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div><strong>Empresa:</strong> {stats.empresaNome}</div>
              <div><strong>Campanha:</strong> {stats.campanhaNome}</div>
              <div><strong>Tipo:</strong> {CAMPAIGN_TYPE_LABEL[stats.campanhaTipo]}</div>
              {stats.parentNome && <div><strong>Campanha original:</strong> {stats.parentNome}</div>}
              <div><strong>Início da vigência:</strong> {fmt(stats.inicio)}</div>
              <div><strong>Respostas válidas:</strong> {stats.totalValidas}</div>
              <div><strong>Última resposta:</strong> {fmt(stats.ultimaResposta)}</div>
            </div>

            {stats.totalValidas === 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Nenhuma resposta válida recebida nesta reavaliação setorial.
              </div>
            )}
            {stats.ignoradas.campanhaAntiga > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Atenção: existem {stats.ignoradas.campanhaAntiga} resposta(s) antiga(s) da empresa em outras campanhas — não fazem parte desta reavaliação e foram ignoradas.
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2">Por setor/GES</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Setor / GES</TableHead>
                      <TableHead className="text-right">Respostas</TableHead>
                      <TableHead>Funções respondidas</TableHead>
                      <TableHead>Última resposta</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.setores.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem setores no escopo.</TableCell></TableRow>
                    )}
                    {stats.setores.map((s) => (
                      <TableRow key={s.setor_id}>
                        <TableCell>{s.nome}{s.ges ? ` — GES ${s.ges}` : ""}</TableCell>
                        <TableCell className="text-right font-mono">{s.respostas}</TableCell>
                        <TableCell className="text-xs">{s.funcoes.join(", ") || "—"}</TableCell>
                        <TableCell className="text-xs">{fmt(s.ultimaResposta)}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.respostas > 0 ? "ativo" : "inativo"} label={s.respostas > 0 ? "Com resposta" : "Sem resposta"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Respostas ignoradas</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Outras campanhas da empresa: {stats.ignoradas.campanhaAntiga}</li>
                <li>Fora do escopo desta campanha: {stats.ignoradas.foraDoEscopo}</li>
                <li>Anteriores ao início da vigência: {stats.ignoradas.anterioresAoInicio}</li>
                <li>Sem setor/GES informado: {stats.ignoradas.semSetor}</li>
                <li>Sem função/cargo informado: {stats.ignoradas.semFuncao}</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

