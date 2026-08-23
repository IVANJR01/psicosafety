import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, CreditCard, ExternalLink, Zap, Crown, Loader2 } from "lucide-react";
import { listAvailablePlans, createCheckoutSession, createBillingPortal, cancelSubscription, resumeSubscription, getSubscriptionStatus } from "@/lib/billing.functions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/assinar")({
  head: () => ({ meta: [{ title: "Assinar Plano | PSICOSAFETY" }, { name: "robots", content: "noindex" }] }),
  component: AssinarPage,
});

function AssinarPage() {
  const navigate = useNavigate();
  const fetchPlans = useServerFn(listAvailablePlans);
  const checkout = useServerFn(createCheckoutSession);
  const portal = useServerFn(createBillingPortal);
  const cancelFn = useServerFn(cancelSubscription);
  const resumeFn = useServerFn(resumeSubscription);
  const subStatusFn = useServerFn(getSubscriptionStatus);
  const [data, setData] = useState<Awaited<ReturnType<typeof listAvailablePlans>> | null>(null);
  const [subStatus, setSubStatus] = useState<Awaited<ReturnType<typeof getSubscriptionStatus>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const reloadAll = async () => {
    const [p, s] = await Promise.all([fetchPlans(), subStatusFn().catch(() => null)]);
    setData(p); setSubStatus(s);
  };

  useEffect(() => { reloadAll().catch((e) => toast.error(e.message)); }, []);

  // Após retornar do Stripe (?checkout=success), faz polling até o webhook ativar
  // a assinatura e o "Plano atual" aparecer automaticamente na tela.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "success") return;
    setConfirming(true);
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        try {
          const fresh = await fetchPlans();
          setData(fresh);
          if (fresh.status === "active") {
            toast.success("Pagamento confirmado! Liberando seu acesso…");
            url.searchParams.delete("checkout");
            window.history.replaceState({}, "", url.pathname + (url.search || ""));
            setConfirming(false);
            // Todos os tipos pagantes (consultor / empresa_direta / admin) usam /admin
            setTimeout(() => navigate({ to: "/admin" }), 600);
            return;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) {
        setConfirming(false);
        toast.message("Pagamento recebido. Aguardando confirmação do Stripe…");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se o usuário escolheu um plano na landing antes do login, dispara o checkout automaticamente
  useEffect(() => {
    if (!data || data.plans.length === 0) return;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem("pendingPlan"); } catch {}
    if (!pending) return;
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const target = norm(pending);
    const match = data.plans.find((p: any) => target.includes(norm(p.nome)) || norm(p.nome).includes(target));
    try { sessionStorage.removeItem("pendingPlan"); } catch {}
    if (match && match.stripe_price_id && (data.status !== "active" || data.currentPlanId !== match.id)) {
      toast.message(`Abrindo checkout do plano ${match.nome}…`);
      assinar(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const assinar = async (planId: string) => {
    setBusy(planId);
    try {
      const { url } = await checkout({ data: { planId } });
      window.location.href = url;
    } catch (e: any) { toast.error(e.message); setBusy(null); }
  };

  const abrirPortal = async () => {
    setBusy("portal");
    try { const { url } = await portal(); window.location.href = url; }
    catch (e: any) { toast.error(e.message); setBusy(null); }
  };

  if (!data) return <div className="p-8 text-muted-foreground">Carregando planos…</div>;

  const currentPlan = data.status === "active"
    ? data.plans.find((p: any) => p.id === data.currentPlanId)
    : null;

  return (
    <div className="max-w-5xl mx-auto">
      {confirming && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-3">
          <span className="h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          Confirmando seu pagamento com o Stripe…
        </div>
      )}

      {currentPlan && (
        <div className="mb-6 rounded-xl border bg-gradient-to-r from-primary/10 to-primary/5 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Seu plano atual</div>
              <div className="font-semibold text-lg leading-tight">{(currentPlan as any).nome}</div>
              <div className="text-sm text-muted-foreground">
                R$ {Number((currentPlan as any).preco_mensal).toFixed(2)}/mês · {(currentPlan as any).max_avaliacoes} avaliações
              </div>
              {subStatus?.hasSubscription && subStatus.cancelAtPeriodEnd && (
                <div className="mt-1 text-xs text-amber-700">
                  Cancelamento agendado{subStatus.cancelAt ? ` para ${new Date(subStatus.cancelAt * 1000).toLocaleDateString("pt-BR")}` : ""}. Você mantém o acesso até lá.
                </div>
              )}
            </div>
          </div>
          {data.hasSubscription && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={abrirPortal} disabled={busy === "portal"}>
                <CreditCard className="h-4 w-4 mr-2" /> Gerenciar <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
              {subStatus?.hasSubscription && subStatus.cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  disabled={busy === "resume"}
                  onClick={async () => {
                    setBusy("resume");
                    try { await resumeFn(); await reloadAll(); toast.success("Assinatura retomada."); }
                    catch (e: any) { toast.error(e.message); }
                    finally { setBusy(null); }
                  }}
                >
                  Retomar assinatura
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  disabled={busy === "cancel"}
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancelar assinatura
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar assinatura?"
        description="Seu acesso continua ativo até o fim do período já pago. Após essa data, a renovação automática não ocorrerá e o acesso será bloqueado. Você pode retomar a qualquer momento antes do vencimento."
        confirmLabel="Sim, cancelar"
        cancelLabel="Manter assinatura"
        destructive
        onConfirm={async () => {
          setBusy("cancel");
          try {
            const r = await cancelFn({ data: { immediately: false } });
            await reloadAll();
            toast.success(
              r.cancelAt
                ? `Cancelamento agendado para ${new Date(r.cancelAt * 1000).toLocaleDateString("pt-BR")}.`
                : "Cancelamento agendado para o fim do período.",
            );
          } catch (e: any) { toast.error(e.message); }
          finally { setBusy(null); }
        }}
      />


      <div className="text-center mb-10 animate-fade-in">
        <Badge variant="outline" className="mb-4 gap-1.5 border-primary/30 bg-primary/5 text-primary">
          <Sparkles className="h-3 w-3" /> Planos PSICOSAFETY
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {currentPlan ? "Escolha um novo " : "Escolha o "}
          <span className="text-shimmer">plano ideal</span>
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-base">
          {data.status === "active"
            ? "Você já tem acesso ativo. Faça upgrade quando precisar ou gerencie sua assinatura."
            : "Libere o acesso imediato ao painel. Pagamento seguro via Stripe, cancele quando quiser."}
        </p>
        {!currentPlan && data.hasSubscription && (
          <Button variant="outline" className="mt-5" onClick={abrirPortal} disabled={busy === "portal"}>
            <CreditCard className="h-4 w-4 mr-2" /> Gerenciar assinatura <ExternalLink className="h-3 w-3 ml-2" />
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-5 md:gap-6 items-stretch">
        {data.plans.length === 0 && (
          <Card className="md:col-span-3"><CardContent className="pt-6 text-center text-muted-foreground">
            Nenhum plano disponível para o seu tipo de conta. Avise o administrador.
          </CardContent></Card>
        )}
        {data.plans.map((p: any, idx: number) => {
          const isActive = data.status === "active";
          const current = isActive && data.currentPlanId === p.id;
          const noPrice = !p.stripe_price_id;
          const loading = busy === p.id;
          // Plano do meio destacado como "Mais Popular" (geralmente Profissional)
          const popular = data.plans.length >= 2 && idx === Math.floor(data.plans.length / 2) && !current;
          const cardClass = popular ? "card-popular" : "card-premium";
          const textOnDark = popular;

          return (
            <div
              key={p.id}
              className={`${cardClass} ${current ? "ring-glow" : ""} ${popular ? "md:-translate-y-2" : ""} animate-fade-in`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <div
                    className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase text-white pulse-ring"
                    style={{ background: "var(--gradient-popular)" }}
                  >
                    <Crown className="h-3 w-3 inline mr-1 -mt-0.5" /> Mais Popular
                  </div>
                </div>
              )}
              <div className="relative p-6 md:p-7 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-xs font-medium uppercase tracking-wider ${textOnDark ? "text-white/60" : "text-muted-foreground"}`}>
                      Plano
                    </div>
                    <div className={`font-bold text-xl mt-0.5 ${textOnDark ? "text-white" : ""}`}>{p.nome}</div>
                  </div>
                  {current && (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-500/15">
                      <Sparkles className="h-3 w-3" /> Atual
                    </Badge>
                  )}
                </div>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className={`text-sm ${textOnDark ? "text-white/60" : "text-muted-foreground"}`}>R$</span>
                  <span className={`text-5xl font-bold tracking-tight ${textOnDark ? "text-white" : ""}`}>
                    {Number(p.preco_mensal).toFixed(0)}
                  </span>
                  <span className={`text-sm ${textOnDark ? "text-white/60" : "text-muted-foreground"}`}>/mês</span>
                </div>
                <div className={`text-xs mt-1 ${textOnDark ? "text-white/50" : "text-muted-foreground"}`}>
                  Renovação automática · cancele quando quiser
                </div>

                <ul className={`mt-6 space-y-3 text-sm flex-1 ${textOnDark ? "text-white/85" : ""}`}>
                  <li className="flex gap-2.5 items-start">
                    <span className={`grid place-items-center h-5 w-5 rounded-full shrink-0 mt-0.5 ${textOnDark ? "bg-white/15" : "bg-emerald-500/15"}`}>
                      <Check className={`h-3 w-3 ${textOnDark ? "text-white" : "text-emerald-600"}`} />
                    </span>
                    <span>Até <strong>{p.max_avaliacoes}</strong> avaliações</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className={`grid place-items-center h-5 w-5 rounded-full shrink-0 mt-0.5 ${textOnDark ? "bg-white/15" : "bg-emerald-500/15"}`}>
                      <Check className={`h-3 w-3 ${textOnDark ? "text-white" : "text-emerald-600"}`} />
                    </span>
                    <span>Relatório AEP completo</span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className={`grid place-items-center h-5 w-5 rounded-full shrink-0 mt-0.5 ${textOnDark ? "bg-white/15" : "bg-emerald-500/15"}`}>
                      <Check className={`h-3 w-3 ${textOnDark ? "text-white" : "text-emerald-600"}`} />
                    </span>
                    <span>Canal de denúncias</span>
                  </li>
                </ul>

                <Button
                  className={`w-full mt-7 h-11 font-semibold rounded-xl ${
                    popular
                      ? "bg-white text-primary hover:bg-white/95"
                      : current
                      ? ""
                      : "btn-premium"
                  }`}
                  disabled={loading || noPrice}
                  onClick={() => assinar(p.id)}
                  variant={current && !popular ? "outline" : "default"}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Abrindo checkout…</>
                  ) : noPrice ? (
                    "Indisponível"
                  ) : current ? (
                    "Plano atual"
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" /> Assinar agora</>
                  )}
                </Button>
                {noPrice && (
                  <p className={`text-[11px] text-center mt-2 ${textOnDark ? "text-amber-200" : "text-amber-600"}`}>
                    Falta configurar o Price ID no Stripe.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center text-xs text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Pagamento seguro Stripe</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Cartão e PIX (anual)</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Cancele a qualquer momento</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Acesso liberado na hora</span>
      </div>
    </div>
  );
}
