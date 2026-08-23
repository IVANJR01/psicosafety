import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, AlertTriangle, Calendar, Building2, Tag, Hash, User2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Resposta } from "@/lib/storage";
import { getEmpresa } from "@/lib/empresas";
import { lookupGes, type GesMap } from "@/lib/exports/aep-data";
import type { CampanhaComEmpresa } from "@/lib/campanhas";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendentes: Resposta[];
  todasRespostas: Resposta[];
  gesMap: GesMap;
  campanhas: CampanhaComEmpresa[];
  onCorrigido: () => void;
};

type Decisao = { tipo: "vincular"; setor: string } | { tipo: "excluir" } | null;

type EmpresaInfo = {
  nome: string;
  setores: { id: string; nome: string }[];
  funcoes: { id: string; nome: string; setor_id: string | null }[];
};

type Sugestao = {
  setor: string;
  motivo: string;
  confianca: "alta" | "média" | "baixa";
};

const confLabel: Record<Sugestao["confianca"], string> = {
  alta: "Confiança alta",
  "média": "Confiança média",
  baixa: "Confiança baixa",
};
const confColor: Record<Sugestao["confianca"], string> = {
  alta: "bg-success/15 text-success border-success/30",
  "média": "bg-primary/15 text-primary border-primary/30",
  baixa: "bg-warning/20 text-warning-foreground border-warning/30",
};

export function CorrigirSetorDialog({
  open, onOpenChange, pendentes, todasRespostas, gesMap, campanhas, onCorrigido,
}: Props) {
  const [empresasInfo, setEmpresasInfo] = useState<Record<string, EmpresaInfo>>({});
  const [decisoes, setDecisoes] = useState<Record<string, Decisao>>({});
  const [confirmaExclusao, setConfirmaExclusao] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setDecisoes({});
      setConfirmaExclusao(null);
      return;
    }
    const codigos = [...new Set(pendentes.map((p) => p.codigoEmpresa))];
    (async () => {
      const acc: Record<string, EmpresaInfo> = {};
      for (const c of codigos) {
        const emp = await getEmpresa(c);
        if (!emp) continue;
        acc[c] = {
          nome: emp.nome,
          setores: (emp.setoresFull ?? []).map((s) => ({ id: s.id, nome: s.nome })),
          funcoes: (emp.funcoesFull ?? []).map((f) => ({ id: f.id, nome: f.nome, setor_id: f.setor_id })),
        };
      }
      setEmpresasInfo(acc);
    })();
  }, [open, pendentes]);

  function sugerir(r: Resposta): Sugestao | null {
    const emp = empresasInfo[r.codigoEmpresa];
    if (!emp) return null;
    const funcaoNorm = (r.cargo || "").trim().toLowerCase();
    // 1) Função vinculada a setor → confiança alta
    if (funcaoNorm) {
      const fn = emp.funcoes.find((f) => f.nome.toLowerCase() === funcaoNorm && f.setor_id);
      if (fn?.setor_id) {
        const s = emp.setores.find((x) => x.id === fn.setor_id);
        if (s) return { setor: s.nome, motivo: `função "${r.cargo}" está cadastrada neste setor`, confianca: "alta" };
      }
    }
    // 2) Padrão por campanha+empresa
    const escopo = todasRespostas.filter(
      (x) => x.codigoEmpresa === r.codigoEmpresa &&
             (r.campanhaId ? x.campanhaId === r.campanhaId : true) &&
             x.id !== r.id && !!(x.setor?.trim()),
    );
    if (escopo.length > 0) {
      const cont: Record<string, number> = {};
      escopo.forEach((x) => { cont[x.setor] = (cont[x.setor] || 0) + 1; });
      const [top, qtd] = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
      const total = escopo.length;
      const pct = qtd / total;
      const conf: Sugestao["confianca"] = pct >= 0.6 ? "alta" : pct >= 0.3 ? "média" : "baixa";
      return {
        setor: top,
        motivo: r.campanhaId
          ? `setor com mais respostas (${qtd}/${total}) na mesma campanha`
          : `setor com mais respostas (${qtd}/${total}) da empresa`,
        confianca: conf,
      };
    }
    return null;
  }

  const todasDecididas = useMemo(
    () => pendentes.every((r) => !!decisoes[r.id]),
    [decisoes, pendentes],
  );

  const aplicar = async () => {
    setBusy(true);
    try {
      for (const r of pendentes) {
        const d = decisoes[r.id];
        if (!d) continue;
        if (d.tipo === "excluir") {
          const { error } = await supabase.from("respostas").delete().eq("id", r.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.rpc("atualizar_setor_resposta" as any, {
            p_id: r.id,
            p_setor: d.setor,
            p_funcao: null,
          });
          if (error) throw error;
        }
      }
      const vinculados = pendentes.filter((r) => decisoes[r.id]?.tipo === "vincular").length;
      const excluidos = pendentes.filter((r) => decisoes[r.id]?.tipo === "excluir").length;
      if (vinculados === 1 && excluidos === 0) {
        const d = decisoes[pendentes[0].id] as { tipo: "vincular"; setor: string };
        const ges = lookupGes(pendentes[0].codigoEmpresa, d.setor, gesMap);
        toast.success(`Resposta vinculada ao setor ${d.setor}${ges ? ` (GES ${ges})` : ""} com sucesso.`);
      } else {
        toast.success(`Saneamento concluído: ${vinculados} vinculada(s), ${excluidos} excluída(s).`);
      }
      onCorrigido();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao aplicar saneamento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Saneamento — respostas sem setor/GES
          </DialogTitle>
          <DialogDescription>
            Decida o destino de cada resposta órfã antes de gerar o AEP. Cada item exige uma escolha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {pendentes.map((r) => {
            const emp = empresasInfo[r.codigoEmpresa];
            const camp = campanhas.find((c) => c.id === r.campanhaId);
            const sug = sugerir(r);
            const d = decisoes[r.id];
            const data = new Date(r.criadoEm).toLocaleString("pt-BR");
            const origem = r.campanhaId ? "Campanha (link público)" : "Manual / link assinado / importação";
            return (
              <div key={r.id} className="rounded-lg border bg-card p-4 space-y-3">
                {/* Detalhes */}
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <Info icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value={r.nomeEmpresa} />
                  <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Data da resposta" value={data} />
                  <Info icon={<Tag className="h-3.5 w-3.5" />} label="Campanha" value={camp?.nome ?? "—"} />
                  <Info icon={<User2 className="h-3.5 w-3.5" />} label="Função/cargo" value={r.cargo?.trim() || "(não informado)"} />
                  <Info icon={<AlertTriangle className="h-3.5 w-3.5 text-warning" />} label="Setor/GES atual" value="vazio" valueClass="text-warning font-semibold" />
                  <Info icon={<Hash className="h-3.5 w-3.5" />} label="ID" value={<code className="text-[10px]">{r.id}</code>} />
                  <Info icon={<Tag className="h-3.5 w-3.5" />} label="Origem" value={origem} />
                </div>

                {/* Sugestão */}
                {sug && (
                  <div className={`flex items-start gap-2 rounded-md border p-2.5 ${confColor[sug.confianca]}`}>
                    <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="text-xs leading-snug">
                      <div className="font-semibold">
                        Sugestão: {sug.setor}
                        {(() => {
                          const g = lookupGes(r.codigoEmpresa, sug.setor, gesMap);
                          return g ? ` (GES ${g})` : "";
                        })()}
                      </div>
                      <div className="opacity-90">Motivo: {sug.motivo}</div>
                      <div className="opacity-90">{confLabel[sug.confianca]}</div>
                      <button
                        type="button"
                        className="mt-1 underline font-medium"
                        onClick={() => setDecisoes((p) => ({ ...p, [r.id]: { tipo: "vincular", setor: sug.setor } }))}
                      >
                        Aceitar sugestão
                      </button>
                    </div>
                  </div>
                )}

                {/* Escolha manual */}
                <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div>
                    <Label className="text-xs">Vincular ao setor</Label>
                    <Select
                      value={d?.tipo === "vincular" ? d.setor : ""}
                      onValueChange={(v) => setDecisoes((p) => ({ ...p, [r.id]: { tipo: "vincular", setor: v } }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o setor/GES" /></SelectTrigger>
                      <SelectContent>
                        {(emp?.setores ?? []).map((s) => {
                          const g = lookupGes(r.codigoEmpresa, s.nome, gesMap);
                          return (
                            <SelectItem key={s.id} value={s.nome}>
                              {s.nome}{g ? ` — GES ${g}` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/admin/relatorio?resposta=${r.id}`, "_blank")}
                    type="button"
                  >
                    Abrir resposta
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmaExclusao(r.id)}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                </div>

                {/* Status da decisão */}
                <div className="text-xs">
                  {!d && <span className="text-warning">⚠ Aguardando decisão</span>}
                  {d?.tipo === "vincular" && (
                    <span className="text-success">✓ Vincular ao setor: <strong>{d.setor}</strong></span>
                  )}
                  {d?.tipo === "excluir" && (
                    <span className="text-destructive">✓ Marcada para exclusão</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={aplicar}
            disabled={busy || !todasDecididas}
            loading={busy}
            loadingText="Aplicando..."
          >
            Aplicar saneamento ({pendentes.length})
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmação de exclusão */}
      <Dialog open={!!confirmaExclusao} onOpenChange={(v) => !v && setConfirmaExclusao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir resposta?</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja descartar esta resposta do relatório? Essa ação pode alterar os percentuais da avaliação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmaExclusao(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmaExclusao) {
                  setDecisoes((p) => ({ ...p, [confirmaExclusao]: { tipo: "excluir" } }));
                }
                setConfirmaExclusao(null);
              }}
            >
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function Info({ icon, label, value, valueClass = "" }: { icon: React.ReactNode; label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-foreground ${valueClass}`}>{value}</div>
      </div>
    </div>
  );
}
