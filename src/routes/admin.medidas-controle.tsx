import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAccountInfo } from "@/lib/account";
import { DIMENSIONS } from "@/lib/copsoq";
import {
  listControlMeasures, createControlMeasure, updateControlMeasure, deleteControlMeasure,
  CONTROL_STATUS_LABEL, EFFECTIVENESS_LABEL,
  type ControlMeasure, type ControlType, type ControlStatus, type EffectivenessStatus,
} from "@/lib/control-measures";

export const Route = createFileRoute("/admin/medidas-controle")({
  head: () => ({ meta: [{ title: "Medidas de Controle | Painel" }, { name: "robots", content: "noindex" }] }),
  component: MedidasControlePage,
});

type EmpresaRow = { id: string; nome: string; codigo: string };
type SetorRow = { id: string; empresa_id: string; nome: string; ges: string | null };
type FuncaoRow = { id: string; empresa_id: string; setor_id: string | null; nome: string };

const TIPOS: { value: ControlType; label: string }[] = [
  { value: "existente", label: "Controle existente" },
  { value: "recomendada", label: "Medida recomendada" },
];

const STATUS_OPTS = Object.entries(CONTROL_STATUS_LABEL) as [ControlStatus, string][];
const EFICACIA_OPTS = Object.entries(EFFECTIVENESS_LABEL) as [EffectivenessStatus, string][];

const NIVEIS_PGR = ["TRIVIAL", "TOLERÁVEL", "MODERADO", "SUBSTANCIAL", "INTOLERÁVEL"];

// Perigos/fatores de risco sugeridos por domínio COPSOQBR (alinhados ao Guia MTE / Anexo I do relatório).
// Precisam bater com o texto usado no Inventário do PDF para o lookup encontrar a medida.
const PERIGOS_POR_DOMINIO: Record<string, string[]> = {
  demandas: [
    "Excesso de demandas no trabalho (sobrecarga)",
    "Ritmo de trabalho excessivo / pressão temporal",
    "Trabalho emocionalmente desgastante",
  ],
  organizacao: [
    "Baixo controle no trabalho / Falta de autonomia",
    "Baixa clareza de papéis / ambiguidade de função",
    "Falta de informação e previsibilidade no trabalho",
  ],
  relacoes: [
    "Falta de apoio social de colegas e chefia",
    "Conflitos interpessoais no trabalho",
    "Falhas na liderança / gestão de pessoas",
  ],
  interface: [
    "Conflito trabalho-vida pessoal",
    "Invasão do trabalho fora do expediente",
  ],
  saude: [
    "Estresse ocupacional / esgotamento",
    "Prejuízo do sono relacionado ao trabalho",
  ],
  ofensivos: [
    "Assédio moral",
    "Assédio sexual",
    "Violência no trabalho",
    "Discriminação no trabalho",
  ],
  seguranca: [
    "Trabalho em condições de difícil comunicação / Falhas na gestão da segurança do trabalho",
  ],
  reconhecimento: [
    "Falta de reconhecimento / recompensa no trabalho",
  ],
};

type FormState = {
  id?: string;
  empresa_id: string;
  setor_id: string;
  funcao_id: string;
  dominio: string;
  perigo: string;
  risk_level_pgr: string;
  control_type: ControlType;
  description: string;
  status: ControlStatus;
  responsible_name: string;
  due_date: string;
  implementation_date: string;
  evidence_description: string;
  evidence_url: string;
  validated: boolean;
  effectiveness_status: EffectivenessStatus;
  notes: string;
};

const emptyForm = (empresaId = ""): FormState => ({
  empresa_id: empresaId,
  setor_id: "",
  funcao_id: "",
  dominio: "",
  perigo: "",
  risk_level_pgr: "",
  control_type: "existente",
  description: "",
  status: "existente",
  responsible_name: "",
  due_date: "",
  implementation_date: "",
  evidence_description: "",
  evidence_url: "",
  validated: false,
  effectiveness_status: "nao_avaliada",
  notes: "",
});

function MedidasControlePage() {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [setores, setSetores] = useState<SetorRow[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoRow[]>([]);
  const [rows, setRows] = useState<ControlMeasure[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [fEmpresa, setFEmpresa] = useState<string>("todas");
  const [fSetor, setFSetor] = useState<string>("todos");
  const [fDominio, setFDominio] = useState<string>("todos");
  const [fTipo, setFTipo] = useState<string>("todos");
  const [fStatus, setFStatus] = useState<string>("todos");

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<ControlMeasure | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const info = await getCurrentAccountInfo();
      let empQ = supabase.from("empresas").select("id, nome, codigo").order("nome");
      if (info?.accountType === "consultor") {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) empQ = empQ.eq("owner_user_id", u.user.id);
      }
      const [e, s, f, m] = await Promise.all([
        empQ,
        supabase.from("empresa_setores").select("id, empresa_id, nome, ges").eq("status", "active").order("nome"),
        supabase.from("empresa_funcoes").select("id, empresa_id, setor_id, nome").order("nome"),
        listControlMeasures(),
      ]);
      setEmpresas((e.data ?? []) as EmpresaRow[]);
      setSetores((s.data ?? []) as SetorRow[]);
      setFuncoes((f.data ?? []) as FuncaoRow[]);
      setRows(m);
    } catch (err: any) {
      toast.error("Falha ao carregar", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);
  const setorMap = useMemo(() => new Map(setores.map((s) => [s.id, s])), [setores]);

  const setoresDaEmpresa = (empresaId: string) => setores.filter((s) => s.empresa_id === empresaId);
  const funcoesDaEmpresa = (empresaId: string, setorId?: string) =>
    funcoes.filter((f) => f.empresa_id === empresaId && (!setorId || f.setor_id === setorId));

  const filtrados = useMemo(() => {
    return rows.filter((r) => {
      if (fEmpresa !== "todas" && r.empresa_id !== fEmpresa) return false;
      if (fSetor !== "todos" && r.setor_id !== fSetor) return false;
      if (fDominio !== "todos" && r.dominio !== fDominio) return false;
      if (fTipo !== "todos" && r.control_type !== fTipo) return false;
      if (fStatus !== "todos" && r.status !== fStatus) return false;
      return true;
    });
  }, [rows, fEmpresa, fSetor, fDominio, fTipo, fStatus]);

  const abrirNovo = () => {
    const empId = fEmpresa !== "todas" ? fEmpresa : (empresas[0]?.id ?? "");
    setForm(emptyForm(empId));
    setOpenForm(true);
  };

  const abrirEdicao = (r: ControlMeasure) => {
    setForm({
      id: r.id,
      empresa_id: r.empresa_id,
      setor_id: r.setor_id ?? "",
      funcao_id: r.funcao_id ?? "",
      dominio: r.dominio ?? "",
      perigo: r.perigo ?? "",
      risk_level_pgr: r.risk_level_pgr ?? "",
      control_type: r.control_type,
      description: r.description,
      status: r.status,
      responsible_name: r.responsible_name ?? "",
      due_date: r.due_date ?? "",
      implementation_date: r.implementation_date ?? "",
      evidence_description: r.evidence_description ?? "",
      evidence_url: r.evidence_url ?? "",
      validated: r.validated,
      effectiveness_status: r.effectiveness_status,
      notes: r.notes ?? "",
    });
    setOpenForm(true);
  };

  const salvar = async () => {
    if (!form.empresa_id) { toast.error("Selecione a empresa"); return; }
    if (!form.description.trim()) { toast.error("Descreva a medida de controle"); return; }
    if (form.control_type === "existente") {
      if (!form.dominio) { toast.error("Selecione o Domínio COPSOQBR para vincular ao Inventário"); return; }
      if (!form.perigo.trim()) { toast.error("Selecione o Perigo / fator de risco"); return; }
      if (!form.risk_level_pgr) { toast.error("Selecione o Nível de risco PGR"); return; }
    }
    setSaving(true);
    try {
      const payload = {
        empresa_id: form.empresa_id,
        setor_id: form.setor_id || null,
        funcao_id: form.funcao_id || null,
        dominio: form.dominio || null,
        perigo: form.perigo.trim() || null,
        risk_level_pgr: form.risk_level_pgr || null,
        control_type: form.control_type,
        description: form.description.trim(),
        status: form.status,
        responsible_name: form.responsible_name.trim() || null,
        due_date: form.due_date || null,
        implementation_date: form.implementation_date || null,
        evidence_description: form.evidence_description.trim() || null,
        evidence_url: form.evidence_url.trim() || null,
        validated: form.validated,
        validated_at: form.validated ? new Date().toISOString() : null,
        effectiveness_status: form.effectiveness_status,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        await updateControlMeasure(form.id, payload);
        toast.success("Medida atualizada");
      } else {
        await createControlMeasure(payload as any);
        toast.success("Medida cadastrada");
      }
      setOpenForm(false);
      await load();
    } catch (err: any) {
      toast.error("Falha ao salvar", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const excluir = async () => {
    if (!confirmDel) return;
    try {
      await deleteControlMeasure(confirmDel.id);
      toast.success("Medida excluída");
      setConfirmDel(null);
      await load();
    } catch (err: any) {
      toast.error("Falha ao excluir", { description: err?.message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medidas de Controle"
        description="Cadastre controles existentes e medidas recomendadas para o Inventário de Riscos e Plano de Ação."
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-2" /> Nova medida
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-5">
          <div>
            <label className="text-xs font-medium mb-1 block">Empresa</label>
            <Select value={fEmpresa} onValueChange={(v) => { setFEmpresa(v); setFSetor("todos"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Setor / GES</label>
            <Select value={fSetor} onValueChange={setFSetor} disabled={fEmpresa === "todas"}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {setoresDaEmpresa(fEmpresa).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.ges ? `GES ${s.ges} — ` : ""}{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Domínio</label>
            <Select value={fDominio} onValueChange={setFDominio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {DIMENSIONS.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Tipo</label>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Status</label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : filtrados.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10">
              Nenhuma medida cadastrada com esses filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">Empresa</th>
                    <th className="py-2 pr-3">Setor / GES</th>
                    <th className="py-2 pr-3">Domínio</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Descrição</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Validado</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((r) => {
                    const emp = empresaMap.get(r.empresa_id);
                    const setor = r.setor_id ? setorMap.get(r.setor_id) : null;
                    const dim = DIMENSIONS.find((d) => d.id === r.dominio);
                    return (
                      <tr key={r.id} className="border-b hover:bg-secondary/30">
                        <td className="py-2 pr-3">{emp?.nome ?? "—"}</td>
                        <td className="py-2 pr-3">{setor ? `${setor.ges ? `GES ${setor.ges} — ` : ""}${setor.nome}` : "—"}</td>
                        <td className="py-2 pr-3">{dim?.title ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={r.control_type === "existente" ? "default" : "secondary"}>
                            {r.control_type === "existente" ? "Existente" : "Recomendada"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 max-w-[280px] truncate" title={r.description}>{r.description}</td>
                        <td className="py-2 pr-3">{CONTROL_STATUS_LABEL[r.status]}</td>
                        <td className="py-2 pr-3">{r.validated ? <CheckCircle2 className="h-4 w-4 text-success" /> : "—"}</td>
                        <td className="py-2 pr-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicao(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDel(r)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar medida" : "Nova medida de controle"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Empresa *</label>
              <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v, setor_id: "", funcao_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Tipo *</label>
              <Select value={form.control_type} onValueChange={(v) => setForm({ ...form, control_type: v as ControlType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Setor / GES</label>
              <Select value={form.setor_id || "none"} onValueChange={(v) => setForm({ ...form, setor_id: v === "none" ? "" : v, funcao_id: "" })} disabled={!form.empresa_id}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem setor —</SelectItem>
                  {setoresDaEmpresa(form.empresa_id).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.ges ? `GES ${s.ges} — ` : ""}{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Função / Cargo</label>
              <Select value={form.funcao_id || "none"} onValueChange={(v) => setForm({ ...form, funcao_id: v === "none" ? "" : v })} disabled={!form.empresa_id}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem função —</SelectItem>
                  {funcoesDaEmpresa(form.empresa_id, form.setor_id).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">
                Domínio COPSOQBR{form.control_type === "existente" ? " *" : ""}
              </label>
              <Select value={form.dominio || "none"} onValueChange={(v) => setForm({ ...form, dominio: v === "none" ? "" : v, perigo: "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {DIMENSIONS.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">
                Nível de risco PGR{form.control_type === "existente" ? " *" : ""}
              </label>
              <Select value={form.risk_level_pgr || "none"} onValueChange={(v) => setForm({ ...form, risk_level_pgr: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Não definido —</SelectItem>
                  {NIVEIS_PGR.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium mb-1 block">
                Perigo / fator de risco{form.control_type === "existente" ? " *" : ""}
              </label>
              {form.dominio && (PERIGOS_POR_DOMINIO[form.dominio]?.length ?? 0) > 0 ? (
                <Select value={form.perigo || "none"} onValueChange={(v) => setForm({ ...form, perigo: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o perigo do Inventário…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Selecione —</SelectItem>
                    {PERIGOS_POR_DOMINIO[form.dominio].map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.perigo}
                  onChange={(e) => setForm({ ...form, perigo: e.target.value })}
                  placeholder="Selecione primeiro o Domínio COPSOQBR"
                  disabled={!form.dominio}
                />
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                O texto precisa bater com o perigo do Inventário para a medida aparecer no PDF.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium mb-1 block">Descrição da medida *</label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Pausas regulares implantadas; acompanhamento do gestor imediato" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ControlStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Eficácia</label>
              <Select value={form.effectiveness_status} onValueChange={(v) => setForm({ ...form, effectiveness_status: v as EffectivenessStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EFICACIA_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Responsável</label>
              <Input value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">
                {form.control_type === "recomendada" ? "Prazo previsto" : "Data de implantação"}
              </label>
              <Input type="date" value={form.control_type === "recomendada" ? form.due_date : form.implementation_date}
                onChange={(e) => setForm({
                  ...form,
                  ...(form.control_type === "recomendada" ? { due_date: e.target.value } : { implementation_date: e.target.value }),
                })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium mb-1 block">Evidência (descrição)</label>
              <Input value={form.evidence_description} onChange={(e) => setForm({ ...form, evidence_description: e.target.value })}
                placeholder="Ex.: procedimento POP-RH-014" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium mb-1 block">Evidência (URL/anexo)</label>
              <Input value={form.evidence_url} onChange={(e) => setForm({ ...form, evidence_url: e.target.value })} placeholder="https://…" />
            </div>
            <label className="flex items-center gap-2 md:col-span-2 text-sm">
              <input type="checkbox" checked={form.validated} onChange={(e) => setForm({ ...form, validated: e.target.checked })} />
              Validado em campo
            </label>
            <div className="md:col-span-2">
              <label className="text-xs font-medium mb-1 block">Observações</label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Excluir medida"
        description="Esta ação é permanente. Deseja continuar?"
        confirmLabel="Excluir"
        onConfirm={excluir}
      />
    </div>
  );
}
