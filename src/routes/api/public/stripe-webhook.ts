import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const apiKey = process.env.STRIPE_SECRET_KEY;
        if (!secret || !apiKey) {
          return new Response("Stripe não configurado", { status: 500 });
        }
        const stripe = new Stripe(apiKey, { apiVersion: "2024-12-18.acacia" as any });
        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("missing signature", { status: 400 });
        const body = await request.text();

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, secret);
        } catch (e: any) {
          console.error("[stripe-webhook] signature invalid", e?.message);
          return new Response(`Invalid signature: ${e?.message}`, { status: 400 });
        }

        async function activateAndLink(userId: string, patch: Record<string, any>) {
          await supabaseAdmin.from("profiles").update(patch as any).eq("user_id", userId);

          // Após ativar, garante empresa vinculada para contas empresa_direta
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("user_id, email, display_name, account_type, empresa_id, status")
            .eq("user_id", userId)
            .maybeSingle();
          if (!prof) return;
          if ((prof as any).status !== "active") return;
          if ((prof as any).account_type !== "empresa_direta") return;
          if ((prof as any).empresa_id) return;

          const nome = (prof as any).display_name || (prof as any).email || "Minha Empresa";
          const codigo = `E${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
          const { data: emp, error: empErr } = await supabaseAdmin
            .from("empresas")
            .insert({ nome, codigo, owner_user_id: userId, email: (prof as any).email })
            .select("id")
            .single();
          if (empErr || !emp) {
            console.error("[stripe-webhook] create empresa failed", empErr?.message);
            return;
          }
          await supabaseAdmin
            .from("profiles")
            .update({ empresa_id: (emp as any).id })
            .eq("user_id", userId);
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const s = event.data.object as Stripe.Checkout.Session;
              const userId = s.metadata?.user_id;
              const planId = s.metadata?.plan_id;
              if (userId) {
                await activateAndLink(userId, {
                  status: "active",
                  plan_id: planId ?? undefined,
                  stripe_customer_id: (s.customer as string) ?? undefined,
                  stripe_subscription_id: (s.subscription as string) ?? undefined,
                });
              }
              break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.created": {
              const sub = event.data.object as Stripe.Subscription;
              const userId = sub.metadata?.user_id;
              const planId = sub.metadata?.plan_id;
              const active = ["active", "trialing"].includes(sub.status);
              if (userId) {
                await activateAndLink(userId, {
                  status: active ? "active" : "pending",
                  plan_id: planId ?? undefined,
                  stripe_subscription_id: sub.id,
                  stripe_customer_id: sub.customer as string,
                });
              }
              break;
            }
            case "customer.subscription.deleted": {
              const sub = event.data.object as Stripe.Subscription;
              const userId = sub.metadata?.user_id;
              if (userId) {
                await supabaseAdmin
                  .from("profiles")
                  .update({ status: "pending", stripe_subscription_id: null })
                  .eq("user_id", userId);
              }
              break;
            }
          }
        } catch (e: any) {
          console.error("[stripe-webhook] handler error", e?.message);
          return new Response("handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
