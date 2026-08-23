import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Archive, Building2, Check, Pencil, X, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { getCurrentAccountInfo } from "@/lib/account";

export const Route = createFileRoute("/admin/setores")({
  component: SetoresPage,
});

type Empresa = { id: string; nome: string; codigo: string };
type Setor = { id: string; empresa_id: string; nome: string; ges: string | null; status?: string };

function normalizeSetor(v: string) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function setorPareceDuplicado(a: string, b: string) {
  const x = normalizeSetor(a);
  const y = normalizeSetor(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return Math.max(x.length, y.length) >= 8 && levenshtein(x, y) <= 2;
}

function SetoresPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [ges, setGes] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [novo, setNovo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const info = await getCurrentAccountInfo();
    let empQ = supabase.from("empresas").select("id, nome, codigo").order("nome");
    if (info?.accountType === "consultor") {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) empQ = empQ.eq("owner_user_id", u.user.id);
    }
    const [e, s] = await Promise.all([
      empQ,
      supabase.from("empresa_setores").select("id, empresa_id, nome, ges, status").eq("status", "active").order("nome"),
    ]);
    const empList = e.data ?? [];
    setEmpresas(empList);
    const allowedIds = new Set(empList.map((x: any) => x.id));
    setSetores(((s.data ?? []) as any[]).filter((x) => allowedIds.has(x.empresa_id)) as Setor[]);
    if (!empresaId && empList[0]) setEmpresaId(empList[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const adicionar = async () => {
    if (!empresaId || !novo.trim()) return;
    const nomeLimpo = novo.trim().replace(/\s+/g, " ");
    const gesLimpo = ges.trim() || null;
    const existenteParecido = setores.find((s) =>
      s.empresa_id === empresaId &&
      (setorPareceDuplicado(s.nome, nomeLimpo) || (!!gesLimpo && s.ges === gesLimpo))
    );
    if (existenteParecido) {
      toast.warning(`Já existe setor ativo parecido: ${existenteParecido.nome}${existenteParecido.ges ? ` — GES ${existenteParecido.ges}` : ""}. Revise ou use “Unificar setor”.`);
      return;
    }
    const { error } = await supabase
      .from("empresa_setores")
      .insert({ empresa_id: empresaId, nome: nomeLimpo, ges: gesLimpo } as any);
    if (error) return toast.error(error.message);
    toast.success("Setor adicionado");
    setNovo("");
    setGes("");
    load();
  };

  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);

  const arquivar = async (id: string) => {
    const { data, error } = await supabase
      .from("empresa_setores")
      .update({ status: "archived" } as any)
      .eq("id", id)
      .select("id");
    if (error) {
      const msg = String(error.message || "");
      if ((error as any).code === "23503" || /foreign key|referenc/i.test(msg)) {
        toast.error("Este setor possui dados vinculados. Para evitar perda de informações, use “Unificar setor” ou “Arquivar setor”.");
        setArchiveTarget(id);
        return;
      }
      return toast.error(msg);
    }
    if (!data || data.length === 0) {
      return toast.error("Não foi possível arquivar (sem permissão ou setor já arquivado).");
    }
    toast.success("Setor arquivado e ocultado das telas operacionais.");
    setArchiveTarget(null);
    load();
  };

  // Unificação de setores duplicados
  const [unifyOrigem, setUnifyOrigem] = useState<string | null>(null);
  const [unifyDestino, setUnifyDestino] = useState<string>("");
  const [unifyPreview, setUnifyPreview] = useState<any>(null);
  const [unifyBusy, setUnifyBusy] = useState(false);

  const origemSetor = useMemo(
    () => setores.find((s) => s.id === unifyOrigem) ?? null,
    [setores, unifyOrigem],
  );
  const destinosDisponiveis = useMemo(
    () => (origemSetor ? setores.filter((s) => s.empresa_id === origemSetor.empresa_id && s.id !== origemSetor.id && (s.status ?? "active") === "active") : []),
    [setores, origemSetor],
  );

  useEffect(() => {
    setUnifyDestino("");
    setUnifyPreview(null);
  }, [unifyOrigem]);

  useEffect(() => {
    if (!unifyOrigem || !unifyDestino) { setUnifyPreview(null); return; }
    (async () => {
      const { data, error } = await supabase.rpc("preview_unificar_setores" as any, {
        p_origem: unifyOrigem, p_destino: unifyDestino,
      });
      if (!error) setUnifyPreview(data);
    })();
  }, [unifyOrigem, unifyDestino]);

  const executarUnificacao = async () => {
    if (!unifyOrigem || !unifyDestino) return;
    setUnifyBusy(true);
    const { error } = await supabase.rpc("unificar_setores" as any, {
      p_origem: unifyOrigem, p_destino: unifyDestino,
    });
    setUnifyBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Setores unificados com sucesso.");
    setUnifyOrigem(null);
    load();
  };


  const [editId, setEditId] = useState<string | null>(null);
  const [editGes, setEditGes] = useState("");
  const [editNome, setEditNome] = useState("");

  const iniciarEdicao = (s: Setor) => {
    setEditId(s.id);
    setEditGes(s.ges ?? "");
    setEditNome(s.nome ?? "");
  };

  const salvarEdicao = async (id: string) => {
    const nome = editNome.trim();
    if (!nome) return toast.error("Nome do setor é obrigatório");
    const { error } = await supabase
      .from("empresa_setores")
      .update({ nome, ges: editGes.trim() || null } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Setor atualizado");
    setEditId(null);
    load();
  };

  const empresaNome = (id: string) =>
    empresas.find((x) => x.id === id)?.nome ?? "—";

  const setoresFiltrados = empresaId
    ? setores.filter((s) => s.empresa_id === empresaId)
    : setores;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setores"
        description="Cadastre e gerencie os setores de cada empresa."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo setor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="md:w-72">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Nome do setor (ex: Operacional)"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            className="flex-1"
          />
          <Input
            placeholder="GES (ex: 1)"
            value={ges}
            onChange={(e) => setGes(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            className="md:w-32"
          />
          <Button onClick={adicionar}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Setores cadastrados
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({setoresFiltrados.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : setoresFiltrados.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum setor cadastrado para esta empresa.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {setoresFiltrados.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    {editId === s.id ? (
                      <div className="flex flex-col gap-1">
                        <Input
                          autoFocus
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") salvarEdicao(s.id);
                            if (e.key === "Escape") setEditId(null);
                          }}
                          placeholder="Nome do setor"
                          className="h-7 text-xs"
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            value={editGes}
                            onChange={(e) => setEditGes(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") salvarEdicao(s.id);
                              if (e.key === "Escape") setEditId(null);
                            }}
                            placeholder="GES"
                            className="h-7 text-xs w-24"
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => salvarEdicao(s.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium truncate flex items-center gap-2">
                          {s.nome}
                          {s.ges ? (
                            <Badge variant="secondary" className="text-[10px]">GES {s.ges}</Badge>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {empresaNome(s.empresa_id)}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {editId !== s.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => iniciarEdicao(s)}
                        className="h-8 w-8"
                        title="Editar setor"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setUnifyOrigem(s.id)}
                      className="h-8 w-8"
                      title="Unificar com outro setor"
                    >
                      <GitMerge className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setArchiveTarget(s.id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title="Arquivar setor"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!unifyOrigem} onOpenChange={(v) => !v && !unifyBusy && setUnifyOrigem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" /> Unificar setores
            </DialogTitle>
            <DialogDescription>
              Migre os vínculos do setor de origem para o destino sem perder dados. O setor de origem será arquivado e ocultado ao final.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Origem (será arquivado)</div>
              <div className="font-medium">
                {origemSetor?.nome}
                {origemSetor?.ges ? ` — GES ${origemSetor.ges}` : ""}
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Setor de destino</label>
              <Select value={unifyDestino} onValueChange={setUnifyDestino}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor correto" /></SelectTrigger>
                <SelectContent>
                  {destinosDisponiveis.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}{s.ges ? ` — GES ${s.ges}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {unifyPreview && !unifyPreview.erro && (
              <div className="rounded-md border p-3 text-xs space-y-1">
                <div className="font-medium mb-1">Resumo da migração</div>
                <div>Respostas vinculadas: <strong>{unifyPreview.respostas}</strong></div>
                <div>Funções/cargos vinculados: <strong>{unifyPreview.funcoes}</strong></div>
                <div>Funções duplicadas que serão deduplicadas: <strong>{unifyPreview.funcoes_duplicadas ?? 0}</strong></div>
                <div>Campanhas vinculadas: <strong>{unifyPreview.campanhas}</strong></div>
                <div>campaign_sectors vinculados: <strong>{unifyPreview.campaign_sectors ?? unifyPreview.campanhas}</strong></div>
                <div>Avaliações/relatórios vinculados: <strong>{unifyPreview.avaliacoes ?? unifyPreview.respostas}</strong></div>
                <div className="text-muted-foreground mt-1">
                  Cargos com nome idêntico já existentes no destino serão deduplicados, mantendo o cargo do setor correto.
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUnifyOrigem(null)} disabled={unifyBusy}>Cancelar</Button>
            <Button
              onClick={executarUnificacao}
              disabled={!unifyDestino || unifyBusy}
              loading={unifyBusy}
              loadingText="Unificando..."
            >
              Confirmar unificação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!archiveTarget} onOpenChange={(v) => !v && setArchiveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Setor com dados vinculados</DialogTitle>
            <DialogDescription>
              Este setor possui dados vinculados. Para evitar perda de informações, use “Unificar setor” ou “Arquivar setor”.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setUnifyOrigem(archiveTarget);
                setArchiveTarget(null);
              }}
            >
              <GitMerge className="h-4 w-4 mr-1" /> Unificar setor
            </Button>
            <Button variant="destructive" onClick={() => archiveTarget && arquivar(archiveTarget)}>
              <Archive className="h-4 w-4 mr-1" /> Arquivar setor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
