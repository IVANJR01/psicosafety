import { supabase } from "@/integrations/supabase/client";

export type ClienteRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  account_type: "admin" | "consultor" | "empresa_direta";
  status: "pending" | "active";
  created_at: string;
  plan_id: string | null;
  plan_nome: string | null;
  plan_tipo: string | null;
  max_empresas: number | null;
  max_avaliacoes: number | null;
  preco_mensal: number | null;
  empresas_usadas: number;
  avaliacoes_usadas: number;
};

export async function listClientes(): Promise<ClienteRow[]> {
  // 1. profiles + plans
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, account_type, status, created_at, plan_id")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: plans } = await supabase.from("plans" as any).select("*");
  const planMap = new Map<string, any>((plans ?? []).map((p: any) => [p.id, p]));

  // 2. empresas — para contar por owner
  const { data: empresas } = await supabase.from("empresas").select("id, owner_user_id");
  const empByOwner = new Map<string, string[]>();
  (empresas ?? []).forEach((e: any) => {
    if (!e.owner_user_id) return;
    const arr = empByOwner.get(e.owner_user_id) ?? [];
    arr.push(e.id);
    empByOwner.set(e.owner_user_id, arr);
  });

  // 3. respostas — contagem por empresa
  const { data: respostas } = await supabase.from("respostas").select("empresa_id");
  const respByEmpresa = new Map<string, number>();
  (respostas ?? []).forEach((r: any) => {
    respByEmpresa.set(r.empresa_id, (respByEmpresa.get(r.empresa_id) ?? 0) + 1);
  });

  return (profiles ?? []).map((p: any) => {
    const plan = p.plan_id ? planMap.get(p.plan_id) : null;
    const ownedEmpresas = empByOwner.get(p.user_id) ?? [];
    let avaliacoes = 0;
    let empresasUsadas = ownedEmpresas.length;
    if (p.account_type === "empresa_direta") {
      // empresa direta: conta pela empresa vinculada no profile (já existente)
      // não temos owner_user_id, então vai depender do empresa_id do profile.
      // simplificação: se não há owned, mostra 0 (será exibido como "—")
    }
    ownedEmpresas.forEach((id) => { avaliacoes += respByEmpresa.get(id) ?? 0; });
    return {
      user_id: p.user_id,
      email: p.email,
      display_name: p.display_name,
      account_type: p.account_type,
      status: p.status,
      created_at: p.created_at,
      plan_id: p.plan_id,
      plan_nome: plan?.nome ?? null,
      plan_tipo: plan?.tipo ?? null,
      max_empresas: plan?.max_empresas ?? null,
      max_avaliacoes: plan?.max_avaliacoes ?? null,
      preco_mensal: plan ? Number(plan.preco_mensal) : null,
      empresas_usadas: empresasUsadas,
      avaliacoes_usadas: avaliacoes,
    };
  });
}

export async function setClienteStatus(userId: string, status: "active" | "pending") {
  const { error } = await supabase.rpc("admin_set_user_status" as any, { p_user_id: userId, p_status: status });
  if (error) throw error;
}

export async function setClientePlan(userId: string, planId: string | null) {
  const { error } = await supabase.rpc("admin_set_user_plan" as any, { p_user_id: userId, p_plan_id: planId });
  if (error) throw error;
}

export async function getCurrentProfileStatus(): Promise<"pending" | "active" | null> {
  const { data, error } = await supabase.rpc("current_profile_status" as any);
  if (error) return null;
  return (data as any) ?? null;
}
