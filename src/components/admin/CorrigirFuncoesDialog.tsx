import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Resposta } from "@/lib/storage";
import { getEmpresa, addFuncao } from "@/lib/empresas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendentes: Resposta[];
  onCorrigido: () => void;
};

export function CorrigirFuncoesDialog({ open, onOpenChange, pendentes, onCorrigido }: Props) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [novos, setNovos] = useState<Record<string, string>>({});
  const [funcoesEmpresa, setFuncoesEmpresa] = useState<Record<string, { setor_id: string | null; nome: string; setores: { id: string; nome: string }[] }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const codigos = [...new Set(pendentes.map((p) => p.codigoEmpresa))];
    (async () => {
      const acc: typeof funcoesEmpresa = {};
      for (const c of codigos) {
        const emp = await getEmpresa(c);
        if (!emp) continue;
        acc[c] = {
          setor_id: null,
          nome: emp.nome,
          setores: (emp.setoresFull ?? []).map((s) => ({ id: s.id, nome: s.nome })),
        } as any;
        (acc[c] as any).funcoesFull = emp.funcoesFull ?? [];
      }
      setFuncoesEmpresa(acc);
    })();
  }, [open, pendentes]);

  const aplicar = async () => {
    setBusy(true);
    try {
      for (const r of pendentes) {
        const escolhida = (valores[r.id] || "").trim();
        const nova = (novos[r.id] || "").trim();
        const funcao = escolhida === "__nova__" ? nova : escolhida;
        if (!funcao) {
          toast.error(`Informe a função para a avaliação do setor "${r.setor}".`);
          setBusy(false);
          return;
        }
        // Se for nova, cadastra na empresa primeiro (vinculada ao setor, se existir)
        if (escolhida === "__nova__") {
          const emp = (funcoesEmpresa[r.codigoEmpresa] as any);
          const setorObj = emp?.setores?.find((s: any) => s.nome.toLowerCase() === r.setor.toLowerCase());
          await addFuncao(r.codigoEmpresa, funcao, setorObj?.id ?? null);
        }
        const { error } = await supabase.rpc("atualizar_funcao_resposta" as any, {
          p_id: r.id,
          p_funcao: funcao,
        });
        if (error) throw error;
      }
      toast.success("Funções corrigidas com sucesso.");
      onCorrigido();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao corrigir funções.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Corrigir função agora</DialogTitle>
          <DialogDescription>
            Vincule a função correta a cada avaliação. Você pode escolher uma função já cadastrada ou criar uma nova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {pendentes.map((r) => {
            const emp = (funcoesEmpresa[r.codigoEmpresa] as any);
            const setorObj = emp?.setores?.find((s: any) => s.nome.toLowerCase() === (r.setor || "").toLowerCase());
            const todasFn = (emp?.funcoesFull ?? []) as { id: string; nome: string; setor_id: string | null }[];
            const candidatas = setorObj ? todasFn.filter((f) => String(f.setor_id) === String(setorObj.id)) : todasFn;
            const sel = valores[r.id] || "";
            return (
              <div key={r.id} className="rounded-lg border p-3 bg-muted/30 space-y-2">
                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{r.nomeEmpresa}</strong> • GES / Setores:{" "}
                  <strong className="text-foreground">{r.setor || "(sem setor)"}</strong> • Enviada em{" "}
                  {new Date(r.criadoEm).toLocaleString("pt-BR")}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div>
                    <Label>Função</Label>
                    <Select value={sel} onValueChange={(v) => setValores((p) => ({ ...p, [r.id]: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                      <SelectContent>
                        {candidatas.map((f) => (
                          <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                        ))}
                        <SelectItem value="__nova__">+ Cadastrar nova função…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {sel === "__nova__" && (
                    <div>
                      <Label>Nome da nova função</Label>
                      <Input
                        value={novos[r.id] || ""}
                        onChange={(e) => setNovos((p) => ({ ...p, [r.id]: e.target.value }))}
                        placeholder="Ex.: Mecânico"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={aplicar} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Aplicar correções
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
