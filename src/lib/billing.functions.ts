import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHost } from "@tanstack/react-start/server";

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

export const listAvailablePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("account_type, plan_id, status, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Perfil não encontrado");
    const { data: plans } = await supabaseAdmin
      .from("plans" as any)
      .select("*")
      .eq("ativo", true)
      .eq("tipo", (profile as any).account_type)
      .order("preco_mensal");
    return {
      accountType: (profile as any).account_type,
      currentPlanId: (profile as any).plan_id,
      status: (profile as any).status,
      hasSubscription: !!(profile as any).stripe_subscription_id,
      plans: (plans ?? []) as any[],
    };
  });

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const stripe = stripeClient();

    const { data: plan } = await supabaseAdmin
      .from("plans" as any)
      .select("*")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || !(plan as any).stripe_price_id) {
      throw new Error("Plano sem stripe_price_id configurado. Avise o administrador.");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = (profile as any)?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (profile as any)?.email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);
    }

    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const origin = `${proto}://${host}`;

    // Plano anual aceita PIX + cartão; demais (mensal/semestral) apenas cartão.
    const nome = String((plan as any).nome ?? "").toLowerCase();
    const isAnual = nome.includes("anual");
    const paymentMethods = (isAnual ? ["card", "pix"] : ["card"]) as any;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: paymentMethods,
      customer: customerId,
      line_items: [{ price: (plan as any).stripe_price_id, quantity: 1 }],
      success_url: `${origin}/admin?checkout=success`,
      cancel_url: `${origin}/admin/assinar?checkout=cancel`,
      metadata: { user_id: userId, plan_id: data.planId },
      subscription_data: { metadata: { user_id: userId, plan_id: data.planId } },
      allow_promotion_codes: true,
    });

    return { url: session.url! };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ immediately: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const stripe = stripeClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    const subId = (profile as any)?.stripe_subscription_id as string | null;
    if (!subId) throw new Error("Assinatura não encontrada");

    if (data.immediately) {
      await stripe.subscriptions.cancel(subId);
      await supabaseAdmin
        .from("profiles")
        .update({ status: "pending", stripe_subscription_id: null })
        .eq("user_id", userId);
      return { ok: true, immediately: true, cancelAt: null as number | null };
    }

    const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
    return { ok: true, immediately: false, cancelAt: sub.cancel_at ?? (sub as any).current_period_end ?? null };
  });

export const resumeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const stripe = stripeClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    const subId = (profile as any)?.stripe_subscription_id as string | null;
    if (!subId) throw new Error("Assinatura não encontrada");
    const sub = await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
    return { ok: true, cancelAt: sub.cancel_at };
  });

export const getSubscriptionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    const subId = (profile as any)?.stripe_subscription_id as string | null;
    if (!subId) return { hasSubscription: false } as const;
    const stripe = stripeClient();
    const sub = await stripe.subscriptions.retrieve(subId);
    return {
      hasSubscription: true,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      cancelAt: sub.cancel_at,
      currentPeriodEnd: (sub as any).current_period_end,
    } as const;
  });

export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const stripe = stripeClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    const customerId = (profile as any)?.stripe_customer_id;
    if (!customerId) throw new Error("Cliente Stripe não encontrado");
    const host = getRequestHost();
    const proto = host.includes("localhost") ? "http" : "https";
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${proto}://${host}/admin`,
    });
    return { url: session.url };
  });
