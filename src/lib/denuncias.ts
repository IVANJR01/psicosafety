import { supabase } from "@/integrations/supabase/client";

export type DenunciaCategoria =
  | "assedio_moral"
  | "assedio_sexual"
  | "violencia"
  | "ameaca"
  | "discriminacao"
  | "conflito"
  | "outros";

export const CATEGORIA_LABEL: Record<DenunciaCategoria, string> = {
  assedio_moral: "Assédio Moral",
  assedio_sexual: "Assédio Sexual",
  violencia: "Violência",
  ameaca: "Ameaça",
  discriminacao: "Discriminação",
  conflito: "Conflito Interpessoal",
  outros: "Outros",
};

export type DenunciaStatus = "recebida" | "em_analise" | "investigacao" | "concluida" | "arquivada";

export const STATUS_LABEL: Record<DenunciaStatus, string> = {
  recebida: "Recebida",
  em_analise: "Em análise",
  investigacao: "Em investigação",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

export type Denuncia = {
  id: string;
  protocolo: string;
  consulta_token: string;
  empresa_id: string | null;
  codigo_empresa: string | null;
  categoria: DenunciaCategoria;
  descricao: string;
  setor: string | null;
  anonima: boolean;
  nome_denunciante: string | null;
  contato_denunciante: string | null;
  status: DenunciaStatus;
  parecer: string | null;
  created_at: string;
  updated_at: string;
};

function genProtocolo() {
  const y = new Date().getFullYear();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `D-${y}-${r}`;
}
function genToken() {
  return crypto.getRandomValues(new Uint8Array(12)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
}

export async function criarDenuncia(input: {
  codigoEmpresa?: string;
  categoria: DenunciaCategoria;
  descricao: string;
  setor?: string;
  anonima: boolean;
  nome?: string;
  contato?: string;
}): Promise<{ protocolo: string; token: string }> {
  let empresa_id: string | null = null;
  const codigo = (input.codigoEmpresa || "").trim();
  if (!codigo) {
    throw new Error("Informe o nome/código da empresa para registrar a denúncia.");
  }
  const { data: emp } = await supabase
    .from("empresas")
    .select("id")
    .or(`codigo.ilike.${codigo},nome.ilike.${codigo}`)
    .maybeSingle();
  if (!emp) {
    throw new Error("Empresa não encontrada. Confira o nome/código informado pelo RH.");
  }
  empresa_id = emp.id;
  for (let i = 0; i < 5; i++) {
    const protocolo = genProtocolo();
    const consulta_token = genToken();
    const { error } = await supabase.from("denuncias" as any).insert({
      protocolo,
      consulta_token,
      empresa_id,
      codigo_empresa: input.codigoEmpresa || null,
      categoria: input.categoria,
      descricao: input.descricao,
      setor: input.setor || null,
      anonima: input.anonima,
      nome_denunciante: input.anonima ? null : input.nome || null,
      contato_denunciante: input.anonima ? null : input.contato || null,
    });
    if (!error) return { protocolo, token: consulta_token };
    if (!String(error.message).includes("duplicate")) throw error;
  }
  throw new Error("Não foi possível registrar a denúncia, tente novamente.");
}

export async function listarDenuncias(): Promise<Denuncia[]> {
  const { data, error } = await supabase.from("denuncias" as any).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Denuncia[];
}

export async function atualizarStatus(id: string, status: DenunciaStatus, parecer?: string) {
  const { error } = await supabase.from("denuncias" as any).update({ status, parecer: parecer ?? null }).eq("id", id);
  if (error) throw error;
}

export async function consultarPorProtocolo(protocolo: string, token: string): Promise<Denuncia | null> {
  // Usa RPC SECURITY DEFINER — anônimo não tem mais SELECT direto na tabela.
  const { data, error } = await supabase.rpc("consultar_denuncia_publica" as any, {
    p_protocolo: protocolo,
    p_token: token,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as unknown as Denuncia) ?? null;
}

// ---------- Auditoria de acesso ----------
export type DenunciaAcesso = {
  id: string;
  denuncia_id: string;
  user_id: string | null;
  user_email: string | null;
  acao: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export async function registrarAcessoDenuncia(denunciaId: string, acao: string = "view") {
  await supabase.rpc("registrar_acesso_denuncia" as any, {
    p_denuncia_id: denunciaId,
    p_acao: acao,
    p_ip: null,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
  });
}

export async function listarAcessosDenuncia(denunciaId: string): Promise<DenunciaAcesso[]> {
  const { data, error } = await supabase
    .from("denuncia_acessos" as any)
    .select("*")
    .eq("denuncia_id", denunciaId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as DenunciaAcesso[];
}
