import { supabase } from "@/integrations/supabase/client";
import type { Answers } from "./copsoq";

export type Resposta = {
  id: string;
  empresaId?: string | null;
  codigoEmpresa: string;
  nomeEmpresa: string;
  setor: string;
  cargo: string;
  answers: Answers;
  criadoEm: string;
  campanhaId?: string | null;
  /**
   * Versão do instrumento sob a qual esta resposta foi coletada.
   *
   * `answers` é indexado pelo código da pergunta, e o mesmo código significa
   * coisas diferentes em versões diferentes — "a2" era previsibilidade num
   * instrumento e pode ser outra coisa no seguinte. Sem saber a versão, não há
   * como pontuar corretamente.
   *
   * Nulo apenas em respostas anteriores ao versionamento.
   */
  versaoId?: string | null;
};

function mapRow(r: any): Resposta {
  return {
    id: r.id,
    empresaId: r.empresa_id ?? null,
    codigoEmpresa: r.codigo_empresa,
    nomeEmpresa: r.nome_empresa,
    setor: r.setor ?? "",
    cargo: r.funcao ?? "",
    answers: r.answers as Answers,
    criadoEm: r.created_at,
    campanhaId: r.campanha_id ?? null,
    versaoId: r.versao_id ?? null,
  };
}

export async function listRespostas(): Promise<Resposta[]> {
  const { data, error } = await supabase
    .from("respostas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function listRespostasEmpresa(empresaId: string): Promise<Resposta[]> {
  const { data, error } = await supabase
    .from("respostas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function saveResposta(r: {
  codigoEmpresa: string;
  nomeEmpresa: string;
  setor: string;
  cargo: string;
  answers: Answers;
  exp?: number;
  sig?: string;
  campanhaCodigo?: string;
}): Promise<void> {
  // 1) Código de campanha → RPC com vigência server-side
  if (r.campanhaCodigo) {
    const { error } = await supabase.rpc("submeter_resposta_campanha" as any, {
      p_codigo: r.campanhaCodigo,
      p_setor: r.setor || null,
      p_funcao: r.cargo || null,
      p_answers: r.answers as any,
    });
    if (error) {
      const msg = String(error.message);
      if (msg.includes("campanha_nao_encontrada")) throw new Error("Campanha não encontrada");
      if (msg.includes("campanha_inativa")) throw new Error("Campanha inativa");
      if (msg.includes("campanha_nao_iniciada")) throw new Error("Campanha ainda não iniciada");
      if (msg.includes("campanha_encerrada")) throw new Error("Campanha encerrada");
      if (msg.includes("setor_fora_do_escopo")) throw new Error("Este setor/GES não faz parte do escopo desta campanha.");
      throw error;
    }
    return;
  }

  // 2) Link assinado (HMAC) → RPC valida assinatura no servidor
  if (r.sig && r.exp) {
    const { error } = await supabase.rpc("submeter_resposta_assinada" as any, {
      p_codigo: r.codigoEmpresa,
      p_exp: r.exp,
      p_sig: r.sig,
      p_setor: r.setor || null,
      p_funcao: r.cargo || null,
      p_answers: r.answers as any,
    });
    if (error) {
      const msg = String(error.message);
      if (msg.includes("link_expirado")) throw new Error("Link expirado");
      if (msg.includes("assinatura_invalida")) throw new Error("Link inválido");
      if (msg.includes("empresa_nao_encontrada")) throw new Error("Empresa não encontrada");
      throw error;
    }
    return;
  }

  // 3) Fallback legado
  const { error } = await supabase.rpc("submeter_resposta_publica" as any, {
    p_codigo: r.codigoEmpresa,
    p_setor: r.setor || null,
    p_funcao: r.cargo || null,
    p_answers: r.answers as any,
    p_exp: r.exp ?? null,
  });
  if (error) {
    if (String(error.message).includes("link_expirado")) throw new Error("Link expirado");
    if (String(error.message).includes("empresa_nao_encontrada")) throw new Error("Empresa não encontrada");
    throw error;
  }
}

// ---------- Import histórico (admin) ----------
export type ImportRespostaRow = {
  codigoEmpresa: string;
  setor?: string;
  funcao?: string;
  answers: Answers;
  criadoEm?: string;
};
export type ImportRespostasResult = {
  inseridas: number;
  erros: { linha: number; mensagem: string }[];
};

export async function bulkImportRespostas(rows: ImportRespostaRow[]): Promise<ImportRespostasResult> {
  const out: ImportRespostasResult = { inseridas: 0, erros: [] };
  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2;
    const r = rows[i];
    if (!r.codigoEmpresa?.trim()) {
      out.erros.push({ linha, mensagem: "codigo_empresa vazio" });
      continue;
    }
    const { error } = await supabase.rpc("inserir_resposta_admin" as any, {
      p_codigo: r.codigoEmpresa,
      p_setor: r.setor || null,
      p_funcao: r.funcao || null,
      p_answers: r.answers as any,
      p_created_at: r.criadoEm ?? null,
    });
    if (error) {
      const msg = String(error.message);
      if (msg.includes("empresa_nao_encontrada")) out.erros.push({ linha, mensagem: "empresa não encontrada" });
      else if (msg.includes("permissao_negada")) out.erros.push({ linha, mensagem: "sem permissão (admin)" });
      else out.erros.push({ linha, mensagem: msg });
    } else {
      out.inseridas++;
    }
  }
  return out;
}
