import { supabase } from "@/integrations/supabase/client";
import type { Empresa } from "./empresas";
import { hydrateEmpresa } from "./empresas";

export async function adminLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function adminSignup(
  email: string,
  password: string,
  displayName?: string,
  accountType: "consultor" | "empresa_direta" = "empresa_direta",
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/admin`,
      data: {
        ...(displayName ? { display_name: displayName } : {}),
        account_type: accountType,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function adminLogout() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function isEmpresaUser(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "empresa" as any)
    .maybeSingle();
  return !!data;
}

export async function getCurrentEmpresa(): Promise<Empresa | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.empresa_id) return null;
  const { data: emp } = await supabase
    .from("empresas")
    .select("*")
    .eq("id", profile.empresa_id)
    .maybeSingle();
  if (!emp) return null;
  return hydrateEmpresa(emp);
}

export type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  status: string;
  empresa_id: string | null;
  created_at: string;
};

export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function setUserEmpresa(userId: string, empresaId: string | null) {
  const { error } = await supabase
    .from("profiles")
    .update({ empresa_id: empresaId, status: empresaId ? "active" : "pending" })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setUserRole(
  userId: string,
  role: "admin" | "empresa" | "tecnico" | "visualizador",
  enabled: boolean,
) {
  if (enabled) {
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: role as any });
    if (error && !String(error.message).includes("duplicate")) throw error;
  } else {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role as any);
    if (error) throw error;
  }
}

export async function listUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as string);
}
