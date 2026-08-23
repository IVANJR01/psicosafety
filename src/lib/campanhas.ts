import { supabase } from "@/integrations/supabase/client";
import { DIMENSIONS, dimensionRiskScore, loadDimensions, type Answers } from "@/lib/copsoq";

export type CampaignType = "general" | "sector_reassessment" | "complementary";
export type ScopeMode = "all_sectors" | "selected_sectors";

export type Campanha = {
  id: string;
  empresa_id: string;
  nome: string;
  codigo: string;
  inicio: string; // ISO
  fim: string | null;
  ativa: boolean;
  created_at: string;
  campaign_type: CampaignType;
  scope_mode: ScopeMode;
  parent_campaign_id: string | null;
  notes: string | null;
};

export type CampanhaComEmpresa = Campanha & {
  empresa_nome: string;
  empresa_codigo: string;
  setores_escopo?: { id: string; nome: string; ges: string | null }[];
};

export type CampanhaSetorEscopo = { id: string; nome: string; ges: string | null };

export const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  general: "Avaliação geral",
  sector_reassessment: "Reavaliação setorial",
  complementary: "Avaliação complementar",
};

function genCodigo() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function mapCampanhaRow(c: any): CampanhaComEmpresa {
  return {
    id: c.id,
    empresa_id: c.empresa_id,
    nome: c.nome,
    codigo: c.codigo,
    inicio: c.inicio,
    fim: c.fim,
    ativa: c.ativa,
    created_at: c.created_at,
    campaign_type: (c.campaign_type ?? "general") as CampaignType,
    scope_mode: (c.scope_mode ?? "all_sectors") as ScopeMode,
    parent_campaign_id: c.parent_campaign_id ?? null,
    notes: c.notes ?? null,
    empresa_nome: c.empresas?.nome ?? "",
    empresa_codigo: c.empresas?.codigo ?? "",
  };
}

export async function listCampanhas(opts?: { ownerOnly?: boolean }): Promise<CampanhaComEmpresa[]> {
  let empresaIds: string[] | null = null;
  if (opts?.ownerOnly) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return [];
    const { data: emps, error: errEmp } = await supabase
      .from("empresas")
      .select("id")
      .eq("owner_user_id", u.user.id);
    if (errEmp) throw errEmp;
    empresaIds = (emps ?? []).map((e: any) => e.id);
    if (empresaIds.length === 0) return [];
  }
  let q = supabase
    .from("campanhas")
    .select("*, empresas(nome, codigo)")
    .order("created_at", { ascending: false });
  if (empresaIds) q = q.in("empresa_id", empresaIds);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []).map(mapCampanhaRow);

  // Anexa setores do escopo para campanhas com escopo específico
  const scopedIds = rows.filter((r) => r.scope_mode === "selected_sectors").map((r) => r.id);
  if (scopedIds.length) {
    const { data: cs } = await supabase
      .from("campaign_sectors")
      .select("campaign_id, empresa_setores(id, nome, ges)")
      .in("campaign_id", scopedIds);
    const byCamp = new Map<string, { id: string; nome: string; ges: string | null }[]>();
    (cs ?? []).forEach((row: any) => {
      const s = row.empresa_setores;
      if (!s) return;
      const arr = byCamp.get(row.campaign_id) ?? [];
      arr.push({ id: s.id, nome: s.nome, ges: s.ges ?? null });
      byCamp.set(row.campaign_id, arr);
    });
    rows.forEach((r) => {
      if (r.scope_mode === "selected_sectors") r.setores_escopo = byCamp.get(r.id) ?? [];
    });
  }
  return rows;
}

export async function listCampanhasEmpresa(empresaId: string): Promise<Campanha[]> {
  const { data, error } = await supabase
    .from("campanhas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCampanhaRow) as Campanha[];
}

export type CampanhaInput = {
  empresa_id: string;
  nome: string;
  inicio: string;
  fim: string | null;
  ativa: boolean;
  campaign_type: CampaignType;
  scope_mode: ScopeMode;
  parent_campaign_id: string | null;
  notes: string | null;
  setor_ids: string[]; // usado quando scope_mode = selected_sectors
};

async function replaceCampaignSectors(campaignId: string, empresaId: string, setorIds: string[]) {
  await supabase.from("campaign_sectors").delete().eq("campaign_id", campaignId);
  if (setorIds.length === 0) return;
  const rows = setorIds.map((sid) => ({ campaign_id: campaignId, empresa_id: empresaId, setor_id: sid }));
  const { error } = await supabase.from("campaign_sectors").insert(rows);
  if (error) throw error;
}

export async function createCampanha(input: CampanhaInput): Promise<Campanha> {
  if (input.scope_mode === "selected_sectors" && input.setor_ids.length === 0) {
    throw new Error("Selecione pelo menos 1 setor/GES para a campanha.");
  }
  for (let i = 0; i < 5; i++) {
    const codigo = genCodigo();
    const { data, error } = await supabase
      .from("campanhas")
      .insert({
        empresa_id: input.empresa_id,
        nome: input.nome,
        inicio: input.inicio,
        fim: input.fim,
        ativa: input.ativa,
        campaign_type: input.campaign_type,
        scope_mode: input.scope_mode,
        parent_campaign_id: input.parent_campaign_id,
        notes: input.notes,
        codigo,
      })
      .select()
      .single();
    if (!error && data) {
      if (input.scope_mode === "selected_sectors") {
        await replaceCampaignSectors(data.id, input.empresa_id, input.setor_ids);
      }
      return mapCampanhaRow(data);
    }
    if (error && !String(error.message).includes("duplicate")) throw error;
  }
  throw new Error("Não foi possível gerar um código único");
}

export async function updateCampanha(
  id: string,
  patch: Partial<Pick<Campanha, "nome" | "inicio" | "fim" | "ativa" | "campaign_type" | "scope_mode" | "parent_campaign_id" | "notes">> & { setor_ids?: string[]; empresa_id?: string },
) {
  const { setor_ids, empresa_id, ...rest } = patch as any;
  if (Object.keys(rest).length > 0) {
    const { error } = await supabase.from("campanhas").update(rest).eq("id", id);
    if (error) throw error;
  }
  if (setor_ids && empresa_id) {
    await replaceCampaignSectors(id, empresa_id, setor_ids);
  }
}

export async function deleteCampanha(id: string) {
  const { error } = await supabase.from("campanhas").delete().eq("id", id);
  if (error) throw error;
}

export async function getCampanhaByCodigo(codigo: string): Promise<(Campanha & { empresa_nome: string; empresa_codigo: string }) | null> {
  const { data, error } = await supabase
    .from("campanhas")
    .select("*, empresas(nome, codigo)")
    .ilike("codigo", codigo)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapCampanhaRow(data);
}

export type StatusVigencia = "ativa" | "agendada" | "encerrada" | "inativa";

export function statusVigencia(c: Pick<Campanha, "ativa" | "inicio" | "fim">): StatusVigencia {
  if (!c.ativa) return "inativa";
  const now = Date.now();
  if (new Date(c.inicio).getTime() > now) return "agendada";
  if (c.fim && new Date(c.fim).getTime() < now) return "encerrada";
  return "ativa";
}

/**
 * Análise da campanha anterior para pré-seleção de "setores críticos".
 * Retorna, por setor, a quantidade de respostas e a maior classificação
 * observada entre as dimensões COPSOQ (>=70 = Crítico, >=50 = Alto).
 */
export type SetorAnalise = {
  setor: string;
  respostas: number;
  maxScore: number;
  label: "Crítico" | "Alto" | "Moderado" | "Baixo" | "—";
  critico: boolean; // Alto ou Crítico
};

export async function analisarSetoresDaCampanha(campanhaId: string): Promise<SetorAnalise[]> {
  await loadDimensions().catch(() => null);
  const { data, error } = await supabase
    .from("respostas")
    .select("setor, answers")
    .eq("campanha_id", campanhaId);
  if (error) throw error;
  const bySetor = new Map<string, Answers[]>();
  (data ?? []).forEach((r: any) => {
    const s = String(r.setor ?? "").trim();
    if (!s) return;
    const arr = bySetor.get(s) ?? [];
    arr.push(r.answers as Answers);
    bySetor.set(s, arr);
  });
  const out: SetorAnalise[] = [];
  bySetor.forEach((answersList, setor) => {
    // Média das respostas por questão -> maior score dimensional
    const combined: Answers = {};
    const counts: Record<string, number> = {};
    answersList.forEach((a) => {
      Object.entries(a || {}).forEach(([k, v]) => {
        if (typeof v !== "number") return;
        combined[k] = (combined[k] ?? 0) + v;
        counts[k] = (counts[k] ?? 0) + 1;
      });
    });
    Object.keys(combined).forEach((k) => (combined[k] = combined[k] / (counts[k] || 1)));

    let maxScore = 0;
    DIMENSIONS.forEach((d) => {
      const s = dimensionRiskScore(d, combined);
      if (s > maxScore) maxScore = s;
    });
    let label: SetorAnalise["label"] = "—";
    if (answersList.length > 0) {
      if (maxScore >= 70) label = "Crítico";
      else if (maxScore >= 50) label = "Alto";
      else if (maxScore >= 30) label = "Moderado";
      else label = "Baixo";
    }
    out.push({
      setor,
      respostas: answersList.length,
      maxScore,
      label,
      critico: maxScore >= 50,
    });
  });
  return out.sort((a, b) => b.maxScore - a.maxScore);
}

export async function listCampaignSectorIds(campaignId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("campaign_sectors")
    .select("setor_id")
    .eq("campaign_id", campaignId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.setor_id);
}

export async function listCampaignSectors(campaignId: string): Promise<CampanhaSetorEscopo[]> {
  const { data, error } = await supabase
    .from("campaign_sectors")
    .select("empresa_setores(id, nome, ges)")
    .eq("campaign_id", campaignId);
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => row.empresa_setores)
    .filter(Boolean)
    .map((s: any) => ({ id: s.id, nome: s.nome, ges: s.ges ?? null }));
}

// ---------- Acompanhamento de respostas (reavaliação setorial) ----------
export type ReavaliacaoSetorStat = {
  setor_id: string;
  nome: string;
  ges: string | null;
  respostas: number;
  funcoes: string[];
  ultimaResposta: string | null;
};
export type ReavaliacaoStats = {
  campanhaId: string;
  campanhaNome: string;
  empresaNome: string;
  campanhaTipo: CampaignType;
  scopeMode: ScopeMode;
  inicio: string;
  parentNome: string | null;
  setores: ReavaliacaoSetorStat[];
  totalValidas: number;
  ultimaResposta: string | null;
  ignoradas: {
    campanhaAntiga: number;
    foraDoEscopo: number;
    semSetor: number;
    semFuncao: number;
    anterioresAoInicio: number;
  };
};

// ---------- Vigência de resultados (reavaliação setorial) ----------
// Para cada (empresa, setor) que teve uma reavaliação com ≥1 resposta,
// as respostas de outras campanhas para aquele setor deixam de valer
// no recorte consolidado. As antigas permanecem no banco (histórico).
export type VigenciaInfo = {
  empresaId: string;
  setorNome: string;
  campanhaVigenteId: string;
  campanhaVigenteNome: string;
};
type RespostaLike = {
  empresaId?: string | null;
  campanhaId?: string | null;
  setor?: string | null;
};
export function aplicarVigenciaReavaliacao<T extends RespostaLike>(
  respostas: T[],
  campanhas: CampanhaComEmpresa[],
): { respostas: T[]; substituicoes: VigenciaInfo[] } {
  const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();
  const reavals = campanhas
    .filter((c) => c.campaign_type === "sector_reassessment")
    .slice()
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

  const vigente = new Map<string, string>();
  const info: VigenciaInfo[] = [];
  reavals.forEach((c) => {
    const escopo = c.setores_escopo ?? [];
    escopo.forEach((s) => {
      const key = `${c.empresa_id}|${norm(s.nome)}`;
      if (vigente.has(key)) return; // reavaliação mais recente já venceu
      const hasResp = respostas.some(
        (r) => r.campanhaId === c.id && norm(r.setor) === norm(s.nome),
      );
      if (hasResp) {
        vigente.set(key, c.id);
        info.push({ empresaId: c.empresa_id, setorNome: s.nome, campanhaVigenteId: c.id, campanhaVigenteNome: c.nome });
      }
    });
  });

  if (vigente.size === 0) return { respostas, substituicoes: info };

  const filtered = respostas.filter((r) => {
    if (!r.empresaId || !r.setor) return true;
    const key = `${r.empresaId}|${norm(r.setor)}`;
    const v = vigente.get(key);
    if (!v) return true;
    return r.campanhaId === v;
  });
  return { respostas: filtered, substituicoes: info };
}

function normalizeSetor(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

export async function getReavaliacaoStats(campanha: CampanhaComEmpresa): Promise<ReavaliacaoStats> {
  const escopo = campanha.setores_escopo ?? await listCampaignSectors(campanha.id);
  const escopoByNome = new Map<string, CampanhaSetorEscopo>();
  escopo.forEach((s) => escopoByNome.set(normalizeSetor(s.nome), s));

  // Respostas da campanha atual
  const { data: campRows, error } = await supabase
    .from("respostas")
    .select("id, setor, funcao, created_at")
    .eq("campanha_id", campanha.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const inicioMs = new Date(campanha.inicio).getTime();
  const byNome = new Map<string, { count: number; funcoes: Set<string>; ultima: string | null }>();
  let totalValidas = 0;
  let ultimaResposta: string | null = null;
  const ig = { campanhaAntiga: 0, foraDoEscopo: 0, semSetor: 0, semFuncao: 0, anterioresAoInicio: 0 };

  (campRows ?? []).forEach((r: any) => {
    const setorKey = normalizeSetor(r.setor);
    if (!setorKey) { ig.semSetor++; return; }
    if (new Date(r.created_at).getTime() < inicioMs) { ig.anterioresAoInicio++; return; }
    if (campanha.scope_mode === "selected_sectors" && !escopoByNome.has(setorKey)) {
      ig.foraDoEscopo++; return;
    }
    const funcao = String(r.funcao ?? "").trim();
    if (!funcao) { ig.semFuncao++; return; }
    const bucket = byNome.get(setorKey) ?? { count: 0, funcoes: new Set<string>(), ultima: null };
    bucket.count++;
    bucket.funcoes.add(funcao);
    if (!bucket.ultima || new Date(r.created_at) > new Date(bucket.ultima)) bucket.ultima = r.created_at;
    byNome.set(setorKey, bucket);
    totalValidas++;
    if (!ultimaResposta || new Date(r.created_at) > new Date(ultimaResposta)) ultimaResposta = r.created_at;
  });

  // Contagem de respostas antigas da empresa fora desta campanha (para alerta)
  const { count: outrasCampanhas } = await supabase
    .from("respostas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", campanha.empresa_id)
    .neq("campanha_id", campanha.id);
  ig.campanhaAntiga = outrasCampanhas ?? 0;

  const setores: ReavaliacaoSetorStat[] = (
    campanha.scope_mode === "selected_sectors" ? escopo : Array.from(byNome.keys()).map((k) => ({
      id: k, nome: k, ges: null,
    }))
  ).map((s) => {
    const b = byNome.get(normalizeSetor(s.nome));
    return {
      setor_id: s.id,
      nome: s.nome,
      ges: s.ges ?? null,
      respostas: b?.count ?? 0,
      funcoes: b ? Array.from(b.funcoes) : [],
      ultimaResposta: b?.ultima ?? null,
    };
  });

  let parentNome: string | null = null;
  if (campanha.parent_campaign_id) {
    const { data: p } = await supabase.from("campanhas").select("nome").eq("id", campanha.parent_campaign_id).maybeSingle();
    parentNome = (p as any)?.nome ?? null;
  }

  const stats: ReavaliacaoStats = {
    campanhaId: campanha.id,
    campanhaNome: campanha.nome,
    empresaNome: campanha.empresa_nome,
    campanhaTipo: campanha.campaign_type,
    scopeMode: campanha.scope_mode,
    inicio: campanha.inicio,
    parentNome,
    setores,
    totalValidas,
    ultimaResposta,
    ignoradas: ig,
  };

  // eslint-disable-next-line no-console
  console.log("[REAVALIACAO] campaign_id:", campanha.id,
    "\n[REAVALIACAO] company_id:", campanha.empresa_id,
    "\n[REAVALIACAO] setores permitidos:", escopo.map((s) => s.nome),
    "\n[REAVALIACAO] respostas encontradas:", (campRows ?? []).length,
    "\n[REAVALIACAO] respostas válidas:", totalValidas,
    "\n[REAVALIACAO] ignoradas por campanha diferente (empresa):", ig.campanhaAntiga,
    "\n[REAVALIACAO] ignoradas por setor fora do escopo:", ig.foraDoEscopo,
    "\n[REAVALIACAO] ignoradas por data antiga:", ig.anterioresAoInicio,
    "\n[REAVALIACAO] ignoradas sem setor:", ig.semSetor,
    "\n[REAVALIACAO] ignoradas sem função:", ig.semFuncao,
  );

  return stats;
}

