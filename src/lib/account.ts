import { supabase } from "@/integrations/supabase/client";

export type AccountType = "admin" | "consultor" | "empresa_direta";

export type PlanInfo = {
  plan_id: string | null;
  nome: string | null;
  tipo: AccountType | null;
  max_empresas: number;
  max_avaliacoes: number;
  preco_mensal: number;
};

export type AccountUsage = {
  accountType: AccountType;
  plan: PlanInfo | null;
  empresasUsadas: number;
  avaliacoesUsadas: number;
};

export async function getCurrentAccountInfo(): Promise<AccountUsage | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, plan_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const accountType = ((profile as any)?.account_type ?? "empresa_direta") as AccountType;

  let plan: PlanInfo | null = null;
  if ((profile as any)?.plan_id) {
    const { data: p } = await supabase
      .from("plans" as any)
      .select("id, nome, tipo, max_empresas, max_avaliacoes, preco_mensal")
      .eq("id", (profile as any).plan_id)
      .maybeSingle();
    if (p) {
      plan = {
        plan_id: (p as any).id,
        nome: (p as any).nome,
        tipo: (p as any).tipo,
        max_empresas: (p as any).max_empresas,
        max_avaliacoes: (p as any).max_avaliacoes,
        preco_mensal: Number((p as any).preco_mensal),
      };
    }
  }

  // contagem de empresas e avaliações no escopo do usuário
  let empresasUsadas = 0;
  let avaliacoesUsadas = 0;

  if (accountType === "consultor") {
    const { data: emps } = await supabase
      .from("empresas")
      .select("id")
      .eq("owner_user_id", user.id);
    const ids = (emps ?? []).map((e: any) => e.id);
    empresasUsadas = ids.length;
    if (ids.length) {
      const { count } = await supabase
        .from("respostas")
        .select("id", { count: "exact", head: true })
        .in("empresa_id", ids);
      avaliacoesUsadas = count ?? 0;
    }
  } else if (accountType === "admin") {
    const { count: ec } = await supabase.from("empresas").select("id", { count: "exact", head: true });
    const { count: rc } = await supabase.from("respostas").select("id", { count: "exact", head: true });
    empresasUsadas = ec ?? 0;
    avaliacoesUsadas = rc ?? 0;
  } else {
    // empresa_direta
    const { data: prof2 } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if ((prof2 as any)?.empresa_id) {
      empresasUsadas = 1;
      const { count } = await supabase
        .from("respostas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", (prof2 as any).empresa_id);
      avaliacoesUsadas = count ?? 0;
    }
  }

  return { accountType, plan, empresasUsadas, avaliacoesUsadas };
}

export async function listPlans(tipo?: AccountType) {
  let q = supabase.from("plans" as any).select("*").eq("ativo", true).order("preco_mensal");
  if (tipo) q = q.eq("tipo", tipo);
  const { data } = await q;
  return (data ?? []) as any[];
}
