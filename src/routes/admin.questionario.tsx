import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadDimensions } from "@/lib/copsoq";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/questionario")({
  head: () => ({ meta: [{ title: "Questionário | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: QuestionarioAdmin,
});

type Dim = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
};
type Perg = {
  id: string;
  dimensao_id: string;
  codigo: string;
  texto: string;
  escala: "freq" | "grau" | "custom";
  reverse: boolean;
  ordem: number;
  ativo: boolean;
};
type Opc = { id: string; pergunta_id: string; valor: number; rotulo: string; ordem: number };

function QuestionarioAdmin() {
  const [dims, setDims] = useState<Dim[]>([]);
  const [pergs, setPergs] = useState<Perg[]>([]);
  const [opcs, setOpcs] = useState<Opc[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [openDim, setOpenDim] = useState<Record<string, boolean>>({});
  const [confirmDel, setConfirmDel] = useState<{ kind: "dim" | "perg"; id: string; nome: string } | null>(null);

  const reload = async () => {
    setLoading(true);
    const [d, p, o] = await Promise.all([
      supabase.from("questionario_dimensoes").select("*").order("ordem"),
      supabase.from("questionario_perguntas").select("*").order("ordem"),
      supabase.from("questionario_opcoes").select("*").order("ordem"),
    ]);
    if (d.error || p.error || o.error) {
      toast.error("Erro ao carregar questionário");
    } else {
      setDims(d.data as Dim[]);
      setPergs(p.data as Perg[]);
      setOpcs(o.data as Opc[]);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const saveDim = async (d: Dim) => {
    setSavingId(d.id);
    const { error } = await supabase.from("questionario_dimensoes").update({
      slug: d.slug.trim(), titulo: d.titulo.trim(), descricao: d.descricao, ordem: d.ordem, ativo: d.ativo,
    }).eq("id", d.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Dimensão salva");
    await loadDimensions(true);
  };

  const savePerg = async (p: Perg) => {
    setSavingId(p.id);
    const { error } = await supabase.from("questionario_perguntas").update({
      codigo: p.codigo.trim(), texto: p.texto.trim(), escala: p.escala, reverse: p.reverse, ordem: p.ordem, ativo: p.ativo,
    }).eq("id", p.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Pergunta salva");
    await loadDimensions(true);
  };

  const saveOpc = async (o: Opc) => {
    const { error } = await supabase.from("questionario_opcoes").update({
      valor: o.valor, rotulo: o.rotulo.trim(), ordem: o.ordem,
    }).eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success("Opção salva");
    await loadDimensions(true);
  };

  const addDim = async () => {
    const slug = prompt("Slug da nova dimensão (ex.: nova-dimensao):")?.trim();
    if (!slug) return;
    const ordem = Math.max(0, ...dims.map((d) => d.ordem)) + 1;
    const { error } = await supabase.from("questionario_dimensoes").insert({
      slug, titulo: "Nova dimensão", descricao: "", ordem, ativo: true,
    });
    if (error) return toast.error(error.message);
    await reload(); await loadDimensions(true);
  };

  const addPerg = async (dimId: string) => {
    const codigo = prompt("Código único da pergunta (ex.: d5):")?.trim();
    if (!codigo) return;
    const ord = Math.max(0, ...pergs.filter((p) => p.dimensao_id === dimId).map((p) => p.ordem)) + 1;
    const { error } = await supabase.from("questionario_perguntas").insert({
      dimensao_id: dimId, codigo, texto: "Nova pergunta", escala: "freq", reverse: false, ordem: ord, ativo: true,
    });
    if (error) return toast.error(error.message);
    await reload(); await loadDimensions(true);
  };

  const addOpcsForCustom = async (pergId: string) => {
    // cria 5 opções padrão para uma pergunta custom recém-mudada
    const existing = opcs.filter((o) => o.pergunta_id === pergId);
    if (existing.length > 0) return;
    const rows = [5, 4, 3, 2, 1].map((v, i) => ({ pergunta_id: pergId, valor: v, rotulo: `Opção ${v}`, ordem: i + 1 }));
    const { error } = await supabase.from("questionario_opcoes").insert(rows);
    if (error) return toast.error(error.message);
    await reload(); await loadDimensions(true);
  };

  const removeItem = async () => {
    if (!confirmDel) return;
    const table = confirmDel.kind === "dim" ? "questionario_dimensoes" : "questionario_perguntas";
    const { error } = await supabase.from(table).delete().eq("id", confirmDel.id);
    setConfirmDel(null);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    await reload(); await loadDimensions(true);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando questionário…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><ClipboardList className="h-7 w-7 text-primary" />Questionário</span>}
        description={<>Edite dimensões, perguntas e escalas do questionário psicossocial — as mudanças refletem imediatamente no link público. Atenção: alterar <strong>código</strong> de uma pergunta quebra a comparação com respostas antigas.</>}
        actions={<Button onClick={addDim}><Plus className="h-4 w-4 mr-1" /> Nova dimensão</Button>}
      />

      {dims.map((d) => {
        const dimPergs = pergs.filter((p) => p.dimensao_id === d.id).sort((a, b) => a.ordem - b.ordem);
        const open = openDim[d.id] ?? true;
        return (
          <Card key={d.id} className="overflow-hidden">
            <CardHeader className="bg-secondary/40">
              <div className="flex items-start gap-3 flex-wrap">
                <Button size="icon" variant="ghost" onClick={() => setOpenDim({ ...openDim, [d.id]: !open })}>
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <div className="flex-1 min-w-[200px] space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={d.titulo} onChange={(e) => setDims(dims.map((x) => x.id === d.id ? { ...x, titulo: e.target.value } : x))} className="font-semibold text-base" />
                    <Badge variant="outline" className="font-mono text-xs">{d.slug}</Badge>
                  </div>
                  <Textarea value={d.descricao} onChange={(e) => setDims(dims.map((x) => x.id === d.id ? { ...x, descricao: e.target.value } : x))} rows={2} className="text-sm" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Label>Ordem</Label>
                    <Input type="number" className="h-8 w-16" value={d.ordem} onChange={(e) => setDims(dims.map((x) => x.id === d.id ? { ...x, ordem: Number(e.target.value) } : x))} />
                    <Label className="ml-2">Ativa</Label>
                    <Switch checked={d.ativo} onCheckedChange={(v) => setDims(dims.map((x) => x.id === d.id ? { ...x, ativo: v } : x))} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => saveDim(d)} disabled={savingId === d.id}>
                      {savingId === d.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Salvar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDel({ kind: "dim", id: d.id, nome: d.titulo })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            {open && (
              <CardContent className="pt-4 space-y-3">
                {dimPergs.length === 0 && <p className="text-sm text-muted-foreground italic">Sem perguntas nesta dimensão.</p>}
                {dimPergs.map((p) => {
                  const pOpcs = opcs.filter((o) => o.pergunta_id === p.id).sort((a, b) => b.valor - a.valor);
                  return (
                    <div key={p.id} className="rounded-lg border p-3 space-y-2 bg-card">
                      <div className="flex items-start gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs mt-2">{p.codigo}</Badge>
                        <Textarea
                          value={p.texto}
                          onChange={(e) => setPergs(pergs.map((x) => x.id === p.id ? { ...x, texto: e.target.value } : x))}
                          rows={2}
                          className="flex-1 min-w-[240px]"
                        />
                      </div>
                      <div className="flex flex-wrap items-end gap-3 text-xs">
                        <div>
                          <Label className="text-xs">Código</Label>
                          <Input className="h-8 w-24 font-mono" value={p.codigo} onChange={(e) => setPergs(pergs.map((x) => x.id === p.id ? { ...x, codigo: e.target.value } : x))} />
                        </div>
                        <div>
                          <Label className="text-xs">Escala</Label>
                          <Select value={p.escala} onValueChange={(v) => setPergs(pergs.map((x) => x.id === p.id ? { ...x, escala: v as Perg["escala"] } : x))}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="freq">Frequência (padrão)</SelectItem>
                              <SelectItem value="grau">Grau (padrão)</SelectItem>
                              <SelectItem value="custom">Personalizada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Inverter (alto = bom)</Label>
                          <Switch checked={p.reverse} onCheckedChange={(v) => setPergs(pergs.map((x) => x.id === p.id ? { ...x, reverse: v } : x))} />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Ativa</Label>
                          <Switch checked={p.ativo} onCheckedChange={(v) => setPergs(pergs.map((x) => x.id === p.id ? { ...x, ativo: v } : x))} />
                        </div>
                        <div>
                          <Label className="text-xs">Ordem</Label>
                          <Input type="number" className="h-8 w-16" value={p.ordem} onChange={(e) => setPergs(pergs.map((x) => x.id === p.id ? { ...x, ordem: Number(e.target.value) } : x))} />
                        </div>
                        <div className="ml-auto flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => savePerg(p)} disabled={savingId === p.id}>
                            {savingId === p.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Salvar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDel({ kind: "perg", id: p.id, nome: p.codigo })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {p.escala === "custom" && (
                        <div className="mt-2 rounded-md bg-secondary/40 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium">Opções personalizadas (valor 1 a 5)</div>
                            {pOpcs.length === 0 && (
                              <Button size="sm" variant="outline" onClick={() => addOpcsForCustom(p.id)}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> Criar 5 opções
                              </Button>
                            )}
                          </div>
                          {pOpcs.map((o) => (
                            <div key={o.id} className="flex items-center gap-2">
                              <Input type="number" min={1} max={5} className="h-8 w-16" value={o.valor} onChange={(e) => setOpcs(opcs.map((x) => x.id === o.id ? { ...x, valor: Number(e.target.value) } : x))} />
                              <Input className="h-8 flex-1" value={o.rotulo} onChange={(e) => setOpcs(opcs.map((x) => x.id === o.id ? { ...x, rotulo: e.target.value } : x))} />
                              <Button size="sm" variant="outline" onClick={() => saveOpc(o)}>
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="pt-2">
                  <Button size="sm" variant="outline" onClick={() => addPerg(d.id)}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => { if (!v) setConfirmDel(null); }}
        title={`Remover ${confirmDel?.kind === "dim" ? "dimensão" : "pergunta"}?`}
        description={`Esta ação não pode ser desfeita. "${confirmDel?.nome ?? ""}" será removido permanentemente.`}
        onConfirm={async () => { await removeItem(); }}
      />
    </div>
  );
}
