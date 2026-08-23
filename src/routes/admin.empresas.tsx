import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { Copy, Trash2, Plus, ExternalLink, Settings, X, Share2, Pencil, Upload, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  listEmpresas,
  createEmpresa,
  deleteEmpresa,
  getEmpresa,
  addSetor,
  removeSetor,
  addFuncao,
  removeFuncao,
  gerarLinkAssinado,
  updateEmpresa,
  uploadEmpresaLogo,
  type Empresa,
} from "@/lib/storage";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { buildQuestionarioUrl } from "@/lib/public-origin";

export const Route = createFileRoute("/admin/empresas")({
  head: () => ({ meta: [{ title: "Empresas | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: Empresas,
});

function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [openCodigo, setOpenCodigo] = useState<string | null>(null);
  const [shareCodigo, setShareCodigo] = useState<string | null>(null);
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [usage, setUsage] = useState<{ used: number; max: number; tipo: string } | null>(null);

  const refresh = async () => {
    const info = await import("@/lib/account").then((m) => m.getCurrentAccountInfo());
    const ownerOnly = info?.accountType === "consultor";
    setEmpresas(await listEmpresas({ ownerOnly }));
    if (info?.plan) setUsage({ used: info.empresasUsadas, max: info.plan.max_empresas, tipo: info.accountType });
  };
  useEffect(() => { refresh(); }, []);

  const limiteAtingido = usage ? usage.used >= usage.max : false;

  const copyLink = (codigo: string) => {
    const url = buildQuestionarioUrl(codigo);
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const remove = (codigo: string) => {
    if (!confirm("Excluir esta empresa? Respostas existentes serão mantidas.")) return;
    deleteEmpresa(codigo);
    refresh();
  };

  const empresaAberta = openCodigo ? empresas.find((e) => e.codigo === openCodigo) : null;
  const empresaEditando = editingCodigo ? empresas.find((e) => e.codigo === editingCodigo) ?? null : null;

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Gere códigos únicos e gerencie GES / Setores e funções."
        actions={
          <Button onClick={() => setCreatingNew(true)} disabled={limiteAtingido}>
            <Plus className="h-4 w-4 mr-1" /> Nova empresa
          </Button>
        }
      />

      {usage && (
        <div className={`mt-4 rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${limiteAtingido ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-primary/5 border-primary/20"}`}>
          <span>
            {usage.tipo === "consultor" ? "Empresas da sua carteira" : "Sua empresa"}: <strong>{usage.used}/{usage.max}</strong> do plano
          </span>
          {limiteAtingido && <span className="text-xs font-medium">Limite atingido — faça upgrade</span>}
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-center">Setores</TableHead>
                <TableHead className="text-center">Cargos</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-2">
                  <EmptyState
                    icon={Building2}
                    title="Nenhuma empresa cadastrada"
                    description="Crie sua primeira empresa para gerar códigos de questionário e cadastrar GES/funções."
                    action={
                      <Button onClick={() => setCreatingNew(true)} disabled={limiteAtingido}>
                        <Plus className="h-4 w-4 mr-1" /> Nova empresa
                      </Button>
                    }
                  />
                </TableCell></TableRow>
              )}
              {empresas.map((e) => (
                <TableRow key={e.codigo}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      {e.logo_url ? (
                        <img src={e.logo_url} alt={e.nome} className="h-8 w-8 rounded object-cover border" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted grid place-items-center text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate">{e.nome}</div>
                        {e.cidade && <div className="text-[11px] text-muted-foreground truncate">{e.cidade}{e.estado ? ` / ${e.estado}` : ""}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.cnpj || "—"}</TableCell>
                  <TableCell><code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{e.codigo}</code></TableCell>
                  <TableCell className="text-center text-sm">{e.setores?.length ?? 0}</TableCell>
                  <TableCell className="text-center text-sm">{e.funcoes?.length ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(e.criadoEm).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingCodigo(e.codigo)} title="Editar dados">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setOpenCodigo(e.codigo)} title="Setores e funções">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShareCodigo(e.codigo)} title="Gerar link compartilhável">
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copyLink(e.codigo)} title="Copiar link genérico">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild title="Abrir">
                        <a href={buildQuestionarioUrl(e.codigo)} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(e.codigo)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EmpresaFormDialog
        open={creatingNew || !!editingCodigo}
        empresa={empresaEditando}
        onClose={() => { setCreatingNew(false); setEditingCodigo(null); }}
        onSaved={refresh}
      />

      <Dialog open={!!openCodigo} onOpenChange={(o) => !o && setOpenCodigo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{empresaAberta?.nome}</DialogTitle>
            <DialogDescription>
              Cadastre os setores (ou GES — Grupo de Exposição Similar) e as funções desta empresa.
              Vincule cada função a um setor para hierarquia setor → função no questionário.
            </DialogDescription>
          </DialogHeader>

          {empresaAberta && (
            <div className="grid md:grid-cols-2 gap-6">
              <ListaEditavel
                titulo="GES / Setores"
                placeholder="Ex.: Produção, Almoxarifado, GES-01"
                itens={empresaAberta.setores ?? []}
                onAdd={(v) => { addSetor(empresaAberta.codigo, v).then(refresh); }}
                onRemove={(v) => { removeSetor(empresaAberta.codigo, v).then(refresh); }}
              />
              <FuncoesPorSetor
                empresa={empresaAberta}
                onChange={refresh}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ShareLinkDialog
        codigo={shareCodigo}
        empresa={shareCodigo ? empresas.find((e) => e.codigo === shareCodigo) ?? null : null}
        onClose={() => setShareCodigo(null)}
      />
    </div>
  );
}

function ListaEditavel({
  titulo,
  placeholder,
  itens,
  onAdd,
  onRemove,
}: {
  titulo: string;
  placeholder: string;
  itens: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [valor, setValor] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = valor.trim();
    if (!v) return;
    onAdd(v);
    setValor("");
  };
  return (
    <div>
      <h3 className="font-semibold mb-2">{titulo}</h3>
      <form onSubmit={submit} className="flex gap-2 mb-3">
        <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={placeholder} maxLength={80} />
        <Button type="submit" size="sm"><Plus className="h-4 w-4" /></Button>
      </form>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {itens.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item cadastrado.</p>}
        {itens.map((it) => (
          <div key={it} className="flex items-center justify-between gap-2 rounded border bg-card px-3 py-1.5 text-sm">
            <span className="truncate">{it}</span>
            <button
              type="button"
              onClick={() => onRemove(it)}
              className="text-muted-foreground hover:text-destructive"
              title="Remover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FuncoesPorSetor({ empresa, onChange }: { empresa: Empresa; onChange: () => void }) {
  const [nome, setNome] = useState("");
  const [setorId, setSetorId] = useState<string>("__none__");
  const setores = empresa.setoresFull ?? [];
  const funcoes = empresa.funcoesFull ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = nome.trim();
    if (!v) return;
    try {
      await addFuncao(empresa.codigo, v, setorId === "__none__" ? null : setorId);
      setNome("");
      onChange();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao adicionar função");
    }
  };

  const remove = async (id: string) => {
    await removeFuncao(empresa.codigo, id);
    onChange();
  };

  // agrupa: por setor + sem setor
  const grupos: { titulo: string; itens: typeof funcoes }[] = [
    ...setores.map((s) => ({ titulo: s.nome, itens: funcoes.filter((f) => f.setor_id === s.id) })),
    { titulo: "Sem setor", itens: funcoes.filter((f) => !f.setor_id) },
  ];

  return (
    <div>
      <h3 className="font-semibold mb-2">Funções</h3>
      <form onSubmit={submit} className="space-y-2 mb-3">
        <div className="flex gap-2">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Operador, Analista, Líder" maxLength={80} />
          <Button type="submit" size="sm"><Plus className="h-4 w-4" /></Button>
        </div>
        <Select value={setorId} onValueChange={setSetorId}>
          <SelectTrigger className="text-xs"><SelectValue placeholder="Vincular ao setor (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem setor (genérica)</SelectItem>
            {setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </form>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {grupos.map((g) => (
          g.itens.length === 0 ? null : (
            <div key={g.titulo}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{g.titulo}</p>
              <div className="space-y-1.5">
                {g.itens.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 rounded border bg-card px-3 py-1.5 text-sm">
                    <span className="truncate">{f.nome}</span>
                    <button type="button" onClick={() => remove(f.id)} className="text-muted-foreground hover:text-destructive" title="Remover">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        {funcoes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma função cadastrada.</p>}
      </div>
    </div>
  );
}

const EXP_OPCOES = [
  { value: "0", label: "Sem expiração" },
  { value: "1", label: "1 dia" },
  { value: "3", label: "3 dias" },
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
];

function ShareLinkDialog({
  codigo,
  empresa,
  onClose,
}: {
  codigo: string | null;
  empresa: Empresa | null;
  onClose: () => void;
}) {
  const [setor, setSetor] = useState<string>("__none__");
  const [funcao, setFuncao] = useState<string>("__none__");
  const [diasExp, setDiasExp] = useState<string>("7");
  const [assinatura, setAssinatura] = useState<{ exp: number; sig: string } | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (codigo) {
      setSetor("__none__");
      setFuncao("__none__");
      setDiasExp("7");
      setAssinatura(null);
    }
  }, [codigo]);

  // Gera assinatura HMAC sempre que mudar codigo/diasExp (>0)
  useEffect(() => {
    if (!empresa) { setAssinatura(null); return; }
    const dias = Number(diasExp);
    if (dias <= 0) { setAssinatura(null); return; }
    let cancelled = false;
    setGerando(true);
    gerarLinkAssinado(empresa.codigo, dias)
      .then((res) => { if (!cancelled) setAssinatura(res); })
      .catch((e) => { if (!cancelled) toast.error(e?.message ?? "Não foi possível gerar link assinado"); })
      .finally(() => { if (!cancelled) setGerando(false); });
    return () => { cancelled = true; };
  }, [empresa, diasExp]);

  const url = useMemo(() => {
    if (!empresa) return "";
    const params = new URLSearchParams();
    if (setor !== "__none__") params.set("setor", setor);
    if (funcao !== "__none__") params.set("funcao", funcao);
    if (assinatura) {
      params.set("exp", String(assinatura.exp));
      params.set("sig", assinatura.sig);
    }
    const q = params.toString();
    return buildQuestionarioUrl(empresa.codigo, q);
  }, [empresa, setor, funcao, assinatura]);

  const expDate = useMemo(() => {
    if (!assinatura) return null;
    return new Date(assinatura.exp);
  }, [assinatura]);

  const copiar = () => {
    if (gerando) return toast.info("Aguarde o link ser assinado…");
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <Dialog open={!!codigo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Link compartilhável — {empresa?.nome}</DialogTitle>
          <DialogDescription>
            O link abre o questionário direto, sem login, com setor/função pré-preenchidos
            e bloqueados. Defina uma expiração para invalidar o link após o prazo.
          </DialogDescription>
        </DialogHeader>

        {empresa && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>GES / Setores</Label>
                <Select value={setor} onValueChange={(v) => { setSetor(v); setFuncao("__none__"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não pré-preencher</SelectItem>
                    {(empresa.setoresFull ?? []).map((s) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(empresa.setores?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum setor cadastrado.</p>
                )}
              </div>
              <div>
                <Label>Função</Label>
                <Select value={funcao} onValueChange={setFuncao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não pré-preencher</SelectItem>
                    {(() => {
                      const setorObj = (empresa.setoresFull ?? []).find((s) => s.nome === setor);
                      const funcoes = empresa.funcoesFull ?? [];
                      const filtradas = setorObj
                        ? funcoes.filter((f) => f.setor_id === setorObj.id || f.setor_id === null)
                        : funcoes;
                      return filtradas.map((f) => <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>);
                    })()}
                  </SelectContent>
                </Select>
                {(empresa.funcoes?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Nenhuma função cadastrada.</p>
                )}
              </div>
            </div>

            <div>
              <Label>Expiração</Label>
              <Select value={diasExp} onValueChange={setDiasExp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXP_OPCOES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {expDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expira em {expDate.toLocaleString("pt-BR")}
                </p>
              )}
            </div>

            <div>
              <Label>Link gerado</Label>
              <div className="flex gap-2">
                <Input readOnly value={url} className="font-mono text-xs" />
                <Button type="button" onClick={copiar}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={copiar}><Copy className="h-4 w-4 mr-1" /> Copiar link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmpresaFormDialog({
  open, empresa, onClose, onSaved,
}: {
  open: boolean;
  empresa: Empresa | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!empresa;
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    nome: "", cnpj: "", razao_social: "", telefone: "", email: "",
    endereco: "", cidade: "", estado: "",
    responsavel_nome: "", responsavel_cargo: "",
    cnae: "", grau_risco: "", num_trabalhadores: "", resp_formacao: "", resp_registro: "",
    logo_url: "" as string,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      nome: empresa?.nome ?? "",
      cnpj: empresa?.cnpj ?? "",
      razao_social: empresa?.razao_social ?? "",
      telefone: empresa?.telefone ?? "",
      email: empresa?.email ?? "",
      endereco: empresa?.endereco ?? "",
      cidade: empresa?.cidade ?? "",
      estado: empresa?.estado ?? "",
      responsavel_nome: empresa?.responsavel_nome ?? "",
      responsavel_cargo: empresa?.responsavel_cargo ?? "",
      cnae: (empresa as any)?.cnae ?? "",
      grau_risco: (empresa as any)?.grau_risco ?? "",
      num_trabalhadores: (empresa as any)?.num_trabalhadores != null ? String((empresa as any).num_trabalhadores) : "",
      resp_formacao: (empresa as any)?.resp_formacao ?? "",
      resp_registro: (empresa as any)?.resp_registro ?? "",
      logo_url: empresa?.logo_url ?? "",
    });
  }, [open, empresa]);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const onPickLogo = async (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Logo deve ter no máximo 2MB");
    try {
      setUploading(true);
      // Para criação, ainda não temos código — usa um temporário baseado em timestamp
      const codigo = empresa?.codigo ?? `tmp-${Date.now()}`;
      const url = await uploadEmpresaLogo(codigo, file);
      set("logo_url", url);
      toast.success("Logo enviado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.nome.trim().length < 2) return toast.error("Informe o nome da empresa");
    setSaving(true);
    try {
      const payload = {
        ...form,
        num_trabalhadores: form.num_trabalhadores.trim() ? Number(form.num_trabalhadores) : null,
      };
      if (isEdit && empresa) {
        await updateEmpresa(empresa.codigo, payload as any);
        toast.success("Empresa atualizada");
      } else {
        const emp = await createEmpresa(form.nome.trim(), payload as any);
        toast.success(`Empresa criada — código ${emp.codigo}`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar — ${empresa?.nome}` : "Nova empresa"}</DialogTitle>
          <DialogDescription>
            Dados básicos, endereço, responsável e logo da empresa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg border bg-muted overflow-hidden grid place-items-center">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <Label>Logo da empresa</Label>
              <div className="flex gap-2 mt-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-1" /> {uploading ? "Enviando..." : "Enviar logo"}
                </Button>
                {form.logo_url && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("logo_url", "")}>
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">PNG ou JPG, até 2MB.</p>
            </div>
          </div>

          {/* Dados básicos */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Nome fantasia *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} maxLength={120} placeholder="Ex.: Acme Indústria" />
            </div>
            <div className="sm:col-span-2">
              <Label>Razão social</Label>
              <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} maxLength={160} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" maxLength={20} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 0000-0000" maxLength={20} />
            </div>
            <div className="sm:col-span-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={160} />
            </div>
            <div>
              <Label>CNAE</Label>
              <Input value={form.cnae} onChange={(e) => set("cnae", e.target.value)} placeholder="00.00-0/00" maxLength={20} />
            </div>
            <div>
              <Label>Grau de Risco</Label>
              <Input value={form.grau_risco} onChange={(e) => set("grau_risco", e.target.value)} placeholder="1, 2, 3 ou 4" maxLength={20} />
            </div>
            <div>
              <Label>Nº de Trabalhadores</Label>
              <Input
                type="number"
                min={0}
                value={form.num_trabalhadores}
                onChange={(e) => set("num_trabalhadores", e.target.value)}
                placeholder="Ex.: 25"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Endereço</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Logradouro</Label>
                <Textarea value={form.endereco} onChange={(e) => set("endereco", e.target.value)} maxLength={250} rows={2} placeholder="Rua, número, bairro" />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} maxLength={80} />
              </div>
              <div>
                <Label>Estado (UF)</Label>
                <Input value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} maxLength={2} placeholder="SP" />
              </div>
            </div>
          </div>

          {/* Responsável */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Responsável Técnico</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome do responsável</Label>
                <Input value={form.responsavel_nome} onChange={(e) => set("responsavel_nome", e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input value={form.responsavel_cargo} onChange={(e) => set("responsavel_cargo", e.target.value)} maxLength={80} />
              </div>
              <div>
                <Label>Formação</Label>
                <Input
                  value={form.resp_formacao}
                  onChange={(e) => set("resp_formacao", e.target.value)}
                  placeholder="Ex.: Psicólogo / Eng. Segurança"
                  maxLength={160}
                />
              </div>
              <div>
                <Label>Registro Profissional</Label>
                <Input
                  value={form.resp_registro}
                  onChange={(e) => set("resp_registro", e.target.value)}
                  placeholder="Ex.: CRP 06/00000 — CREA — CRT — CRM"
                  maxLength={80}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
