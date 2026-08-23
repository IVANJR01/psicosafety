import { supabase } from "@/integrations/supabase/client";

/**
 * Gera assinatura HMAC server-side para um link público de questionário.
 * RPC valida que o usuário é admin.
 */
export async function gerarLinkAssinado(
  codigo: string,
  validadeDias: number,
): Promise<{ exp: number; sig: string }> {
  const { data, error } = await supabase.rpc("gerar_link_assinado" as any, {
    p_codigo: codigo,
    p_validade_dias: validadeDias,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { exp: Number(row.exp), sig: String(row.sig) };
}

/** Monta a URL pública assinada para compartilhamento. */
export function buildSignedQuestionarioUrl(
  origin: string,
  codigo: string,
  exp: number,
  sig: string,
): string {
  return `${origin}/q/${codigo}?exp=${exp}&sig=${sig}`;
}
