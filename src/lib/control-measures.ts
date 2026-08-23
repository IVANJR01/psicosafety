import { supabase } from "@/integrations/supabase/client";
import { DIMENSIONS } from "./copsoq";


export type ControlType = "existente" | "recomendada";

export type ControlStatus =
  | "nao_evidenciado"
  | "existente"
  | "em_implantacao"
  | "planejado"
  | "implementado"
  | "em_acompanhamento"
  | "ineficaz"
  | "eficaz"
  | "pendente_validacao"
  | "concluido";

export type EffectivenessStatus =
  | "nao_avaliada"
  | "eficaz"
  | "parcialmente_eficaz"
  | "ineficaz"
  | "requer_nova_acao";

export type ControlMeasure = {
  id: string;
  empresa_id: string;
  campanha_id: string | null;
  setor_id: string | null;
  funcao_id: string | null;
  dominio: string | null;
  perigo: string | null;
  risk_level_pgr: string | null;
  control_type: ControlType;
  description: string;
  status: ControlStatus;
  responsible_name: string | null;
  due_date: string | null;
  implementation_date: string | null;
  evidence_description: string | null;
  evidence_url: string | null;
  validated: boolean;
  validated_at: string | null;
  validated_by: string | null;
  effectiveness_status: EffectivenessStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ControlMeasureInput = Partial<
  Omit<ControlMeasure, "id" | "created_at" | "updated_at" | "created_by">
> & {
  empresa_id: string;
  control_type: ControlType;
  description: string;
};

const TB = () => (supabase.from as any)("control_measures");

export const CONTROL_STATUS_LABEL: Record<ControlStatus, string> = {
  nao_evidenciado: "Não evidenciado",
  existente: "Existente",
  em_implantacao: "Em implantação",
  planejado: "Planejado",
  implementado: "Implementado",
  em_acompanhamento: "Em acompanhamento",
  ineficaz: "Ineficaz",
  eficaz: "Eficaz",
  pendente_validacao: "Pendente de validação",
  concluido: "Concluído",
};

export const EFFECTIVENESS_LABEL: Record<EffectivenessStatus, string> = {
  nao_avaliada: "Não avaliada",
  eficaz: "Eficaz",
  parcialmente_eficaz: "Parcialmente eficaz",
  ineficaz: "Ineficaz",
  requer_nova_acao: "Requer nova ação",
};

export async function listControlMeasures(filtros: {
  empresa_id?: string;
  campanha_id?: string;
  setor_id?: string;
  dominio?: string;
  control_type?: ControlType;
} = {}): Promise<ControlMeasure[]> {
  let q = TB().select("*").order("created_at", { ascending: false });
  if (filtros.empresa_id) q = q.eq("empresa_id", filtros.empresa_id);
  if (filtros.campanha_id) q = q.eq("campanha_id", filtros.campanha_id);
  if (filtros.setor_id) q = q.eq("setor_id", filtros.setor_id);
  if (filtros.dominio) q = q.eq("dominio", filtros.dominio);
  if (filtros.control_type) q = q.eq("control_type", filtros.control_type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ControlMeasure[];
}

export async function createControlMeasure(input: ControlMeasureInput): Promise<ControlMeasure> {
  const { data: u } = await supabase.auth.getUser();
  const payload = { ...input, created_by: u.user?.id ?? null };
  const { data, error } = await TB().insert(payload).select("*").single();
  if (error) throw error;
  return data as ControlMeasure;
}

export async function updateControlMeasure(
  id: string,
  patch: Partial<ControlMeasureInput> & { validated?: boolean; validated_at?: string | null; validated_by?: string | null },
): Promise<ControlMeasure> {
  const { data, error } = await TB().update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as ControlMeasure;
}

export async function deleteControlMeasure(id: string): Promise<void> {
  const { error } = await TB().delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
// Integração com o Inventário de Riscos (PDF AEP)
// =====================================================================

export type ControleInventarioMap = Map<string, ControlMeasure[]>;

export function chaveControle(setorId: string | null | undefined, dominio: string | null | undefined) {
  return `${(setorId ?? "").toLowerCase()}|${(dominio ?? "").toLowerCase()}`;
}

export function chaveControleNome(setorNome: string | null | undefined, dominio: string | null | undefined) {
  return `nome:${(setorNome ?? "").trim().toLowerCase()}|${(dominio ?? "").toLowerCase()}`;
}

/**
 * Gera todos os aliases de um domínio para indexação/lookup.
 * Aceita tanto o ID da dimensão COPSOQ ("demandas") quanto o título
 * ("Demandas no trabalho") — retorna ambos em minúsculas + o próprio valor.
 */
function aliasesDominio(dominio: string | null | undefined): string[] {
  const raw = (dominio ?? "").trim();
  if (!raw) return [""];
  const lower = raw.toLowerCase();
  const aliases = new Set<string>([lower]);
  const byId = DIMENSIONS.find((d) => d.id.toLowerCase() === lower);
  const byTitle = DIMENSIONS.find((d) => d.title.toLowerCase() === lower);
  const dim = byId ?? byTitle;
  if (dim) {
    aliases.add(dim.id.toLowerCase());
    aliases.add(dim.title.toLowerCase());
  }
  return Array.from(aliases);
}

/** Carrega os controles EXISTENTES da empresa e indexa por setor_id+dominio E por setor_nome+dominio.
 *  Indexa cada controle sob múltiplos aliases de domínio (id COPSOQ e título) para tolerar variações. */
export async function carregarControlesExistentes(empresa_id: string): Promise<ControleInventarioMap> {
  const rows = await listControlMeasures({ empresa_id, control_type: "existente" });
  const setorIds = Array.from(new Set(rows.map((r) => r.setor_id).filter(Boolean))) as string[];
  const nomePorId = new Map<string, string>();
  if (setorIds.length > 0) {
    const { data } = await (supabase.from as any)("empresa_setores")
      .select("id, nome")
      .in("id", setorIds);
    (data ?? []).forEach((s: any) => nomePorId.set(s.id, String(s.nome ?? "")));
  }
  const map: ControleInventarioMap = new Map();
  const push = (k: string, r: ControlMeasure) => {
    const arr = map.get(k) ?? [];
    if (!arr.includes(r)) arr.push(r);
    map.set(k, arr);
  };
  let semDominio = 0;
  rows.forEach((r) => {
    if (!r.dominio || !r.dominio.trim()) semDominio++;
    const nome = r.setor_id ? nomePorId.get(r.setor_id) : null;
    aliasesDominio(r.dominio).forEach((alias) => {
      push(chaveControle(r.setor_id, alias), r);
      if (nome) push(chaveControleNome(nome, alias), r);
      if (!r.setor_id) push(chaveControleNome("", alias), r);
    });
  });
  console.log("[AUDITORIA-CONTROLES] controles_encontrados:", rows.length, "sem_dominio:", semDominio);
  console.log("[AEP-CONTROLES] carregados:", rows.length, "chaves indexadas:", map.size);
  if (semDominio > 0) {
    console.warn(
      "[AUDITORIA-CONTROLES] ⚠️ Há",
      semDominio,
      "controle(s) SEM domínio COPSOQ preenchido — não aparecerão no Inventário. Edite em Admin › Medidas de controle.",
    );
  }
  return map;
}

const STATUS_VALIDADO: ControlStatus[] = ["implementado", "eficaz", "em_acompanhamento", "concluido"];

/** Gera o texto da coluna "Controles" do Inventário para um bucket setor+dominio. */
export function textoControlesLinha(
  controles: ControlMeasure[] | undefined,
  padrao: string,
): string {
  if (!controles || controles.length === 0) return padrao;

  const linhas: string[] = [];
  let algumValidado = false;
  let algumPendente = false;
  let dataValidacao: string | null = null;

  controles.forEach((c) => {
    linhas.push(c.description.trim());
    if (c.validated || STATUS_VALIDADO.includes(c.status)) {
      algumValidado = true;
      if (!dataValidacao && c.validated_at) dataValidacao = c.validated_at;
    } else {
      algumPendente = true;
    }
  });

  const body = linhas.join("; ");
  if (algumValidado && !algumPendente) {
    const dt = dataValidacao ? ` — validado em campo em ${new Date(dataValidacao).toLocaleDateString("pt-BR")}` : " — validado em campo";
    return `${body}${dt}.`;
  }
  if (algumValidado && algumPendente) {
    return `${body} — controles parcialmente validados em campo; itens pendentes de verificação.`;
  }
  return `${body} — controle informado pela empresa; pendente de validação em campo.`;
}
