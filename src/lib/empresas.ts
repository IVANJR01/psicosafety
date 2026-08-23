import { supabase } from "@/integrations/supabase/client";

export type SetorRow = { id: string; nome: string; ges?: string | null; status?: string };
export type FuncaoRow = { id: string; nome: string; setor_id: string | null };

export type Empresa = {
  id: string;
  codigo: string;
  nome: string;
  criadoEm: string;
  setores?: string[];
  funcoes?: string[];
  setoresFull?: SetorRow[];
  funcoesFull?: FuncaoRow[];
  campanhaCodigo?: string;
  logo_url?: string | null;
  cnpj?: string | null;
  razao_social?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  responsavel_nome?: string | null;
  responsavel_cargo?: string | null;
  cnae?: string | null;
  grau_risco?: string | null;
  num_trabalhadores?: number | null;
  resp_formacao?: string | null;
  resp_registro?: string | null;
};

function genCodigo() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function hydrateEmpresa(row: any): Promise<Empresa> {
  const [setores, funcoes] = await Promise.all([
    supabase.from("empresa_setores").select("id, nome, ges, status").eq("empresa_id", row.id).eq("status", "active").order("nome"),
    supabase.from("empresa_funcoes").select("id, nome, setor_id").eq("empresa_id", row.id).order("nome"),
  ]);
  const setoresFull: SetorRow[] = (setores.data ?? []) as any;
  const funcoesFull: FuncaoRow[] = (funcoes.data ?? []) as any;
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    criadoEm: row.created_at,
    setores: setoresFull.map((s) => s.nome),
    funcoes: funcoesFull.map((f) => f.nome),
    setoresFull,
    funcoesFull,
    logo_url: row.logo_url ?? null,
    cnpj: row.cnpj ?? null,
    razao_social: row.razao_social ?? null,
    telefone: row.telefone ?? null,
    email: row.email ?? null,
    endereco: row.endereco ?? null,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    responsavel_nome: row.responsavel_nome ?? null,
    responsavel_cargo: row.responsavel_cargo ?? null,
    cnae: row.cnae ?? null,
    grau_risco: row.grau_risco ?? null,
    num_trabalhadores: row.num_trabalhadores ?? null,
    resp_formacao: row.resp_formacao ?? null,
    resp_registro: row.resp_registro ?? null,
  };
}

export async function listEmpresas(opts?: { ownerOnly?: boolean }): Promise<Empresa[]> {
  let q = supabase.from("empresas").select("*").order("created_at", { ascending: false });
  if (opts?.ownerOnly) {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) q = q.eq("owner_user_id", u.user.id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return Promise.all((data ?? []).map(hydrateEmpresa));
}

export async function getEmpresa(codigo: string): Promise<Empresa | null> {
  // Authenticated callers (admin/consultor/empresa) read directly so they
  // still get full PII (cnpj, email, etc.) needed for reports.
  const { data: u } = await supabase.auth.getUser();
  if (u.user) {
    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .ilike("codigo", codigo)
      .maybeSingle();
    if (error) throw error;
    if (data) return hydrateEmpresa(data);

    const { data: camp, error: errC } = await supabase
      .from("campanhas")
          .select("id, empresa_id, codigo, scope_mode, empresas(*)")
      .ilike("codigo", codigo)
      .maybeSingle();
    if (errC) throw errC;
    if (camp && (camp as any).empresas) {
      const emp = await hydrateEmpresa((camp as any).empresas);
      emp.campanhaCodigo = (camp as any).codigo;
      if ((camp as any).scope_mode === "selected_sectors") {
        const { data: cs } = await supabase
          .from("campaign_sectors")
          .select("setor_id")
          .eq("campaign_id", (camp as any).id);
        const allowed = new Set((cs ?? []).map((r: any) => r.setor_id));
        emp.setoresFull = (emp.setoresFull ?? []).filter((s) => allowed.has(s.id));
        emp.setores = emp.setoresFull.map((s) => s.nome);
        emp.funcoesFull = (emp.funcoesFull ?? []).filter((f) => !f.setor_id || allowed.has(f.setor_id));
        emp.funcoes = emp.funcoesFull.map((f) => f.nome);
      }
      return emp;
    }
    // Authenticated user has no row visibility — fall through to public RPC.
  }

  // Anonymous path: SECURITY DEFINER RPC returns only public-safe fields
  // (id, nome, codigo, logo_url + setores/funcoes) for the questionnaire.
  const { data, error } = await supabase.rpc("get_empresa_publica" as any, { p_codigo: codigo });
  if (error) throw error;
  if (!data) return null;
  const d: any = data;
  const setoresFull: SetorRow[] = (d.setores ?? []) as any;
  const funcoesFull: FuncaoRow[] = (d.funcoes ?? []) as any;
  const emp: Empresa = {
    id: d.id,
    codigo: d.codigo,
    nome: d.nome,
    criadoEm: "",
    setores: setoresFull.map((s) => s.nome),
    funcoes: funcoesFull.map((f) => f.nome),
    setoresFull,
    funcoesFull,
    logo_url: d.logo_url ?? null,
  };
  if (d.campanha_codigo) emp.campanhaCodigo = d.campanha_codigo;
  return emp;
}

export async function createEmpresa(nome: string, extra?: Partial<Empresa>): Promise<Empresa> {
  const { data: u } = await supabase.auth.getUser();
  const ownerId = u.user?.id ?? null;
  const payload: any = {
    nome,
    owner_user_id: ownerId,
    cnpj: extra?.cnpj ?? null,
    razao_social: extra?.razao_social ?? null,
    telefone: extra?.telefone ?? null,
    email: extra?.email ?? null,
    endereco: extra?.endereco ?? null,
    cidade: extra?.cidade ?? null,
    estado: extra?.estado ?? null,
    responsavel_nome: extra?.responsavel_nome ?? null,
    responsavel_cargo: extra?.responsavel_cargo ?? null,
    cnae: extra?.cnae ?? null,
    grau_risco: extra?.grau_risco ?? null,
    num_trabalhadores: extra?.num_trabalhadores ?? null,
    resp_formacao: extra?.resp_formacao ?? null,
    resp_registro: extra?.resp_registro ?? null,
    logo_url: extra?.logo_url ?? null,
  };
  for (let i = 0; i < 5; i++) {
    const codigo = genCodigo();
    const { data, error } = await supabase
      .from("empresas")
      .insert({ ...payload, codigo })
      .select()
      .single();
    if (!error && data) return hydrateEmpresa(data);
    if (error && !String(error.message).includes("duplicate")) throw error;
  }
  throw new Error("Não foi possível gerar um código único");
}

export async function updateEmpresa(codigo: string, patch: Partial<Empresa>): Promise<void> {
  const allowed = [
    "nome", "cnpj", "razao_social", "telefone", "email",
    "endereco", "cidade", "estado", "responsavel_nome", "responsavel_cargo", "logo_url",
    "cnae", "grau_risco", "num_trabalhadores", "resp_formacao", "resp_registro",
  ] as const;
  const update: any = {};
  for (const k of allowed) if (k in patch) update[k] = (patch as any)[k];
  const { error } = await supabase.from("empresas").update(update).eq("codigo", codigo);
  if (error) throw error;
}

export async function uploadEmpresaLogo(codigo: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${codigo.toLowerCase()}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("empresa-logos").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("empresa-logos").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteEmpresa(codigo: string) {
  const { error } = await supabase.from("empresas").delete().eq("codigo", codigo);
  if (error) throw error;
}

async function empresaIdFromCodigo(codigo: string): Promise<string | null> {
  const { data } = await supabase.from("empresas").select("id").eq("codigo", codigo).maybeSingle();
  return data?.id ?? null;
}

export async function addSetor(codigo: string, nome: string) {
  const v = nome.trim().replace(/\s+/g, " ");
  if (!v) return;
  const empresa_id = await empresaIdFromCodigo(codigo);
  if (!empresa_id) return;
  await supabase.from("empresa_setores").insert({ empresa_id, nome: v });
}

export async function removeSetor(codigo: string, nome: string) {
  const empresa_id = await empresaIdFromCodigo(codigo);
  if (!empresa_id) return;
  await supabase.from("empresa_setores").delete().eq("empresa_id", empresa_id).eq("nome", nome);
}

export async function addFuncao(codigo: string, nome: string, setorId?: string | null) {
  const v = nome.trim().replace(/\s+/g, " ");
  if (!v) return;
  const empresa_id = await empresaIdFromCodigo(codigo);
  if (!empresa_id) return;
  await supabase.from("empresa_funcoes").insert({ empresa_id, nome: v, setor_id: setorId ?? null });
}

export async function removeFuncao(codigo: string, nomeOrId: string) {
  const empresa_id = await empresaIdFromCodigo(codigo);
  if (!empresa_id) return;
  const isUuid = /^[0-9a-f-]{36}$/i.test(nomeOrId);
  const q = supabase.from("empresa_funcoes").delete().eq("empresa_id", empresa_id);
  if (isUuid) await q.eq("id", nomeOrId);
  else await q.eq("nome", nomeOrId);
}

// ---------- BULK IMPORT (CSV) ----------
export type ImportRow = { empresa: string; setor?: string; funcao?: string };
export type ImportResult = {
  empresasCriadas: number;
  empresasReaproveitadas: number;
  setoresCriados: number;
  funcoesCriadas: number;
  erros: { linha: number; mensagem: string }[];
};

export async function bulkImport(rows: ImportRow[]): Promise<ImportResult> {
  const result: ImportResult = {
    empresasCriadas: 0,
    empresasReaproveitadas: 0,
    setoresCriados: 0,
    funcoesCriadas: 0,
    erros: [],
  };

  const empresasExistentes = await listEmpresas();
  const empresaPorNome = new Map<string, Empresa>();
  for (const e of empresasExistentes) empresaPorNome.set(e.nome.toLowerCase(), e);

  const setoresCache = new Map<string, Map<string, string>>();
  const funcoesCache = new Map<string, Set<string>>();

  const ensureSetorMap = async (empresaId: string) => {
    if (setoresCache.has(empresaId)) return setoresCache.get(empresaId)!;
    const { data } = await supabase.from("empresa_setores").select("id, nome").eq("empresa_id", empresaId).eq("status", "active");
    const m = new Map<string, string>();
    for (const r of data ?? []) m.set(String(r.nome).toLowerCase(), r.id);
    setoresCache.set(empresaId, m);
    return m;
  };
  const ensureFuncoesSet = async (empresaId: string) => {
    if (funcoesCache.has(empresaId)) return funcoesCache.get(empresaId)!;
    const { data } = await supabase.from("empresa_funcoes").select("nome, setor_id").eq("empresa_id", empresaId);
    const s = new Set<string>();
    for (const r of data ?? []) s.add(`${r.setor_id ?? "null"}|${String(r.nome).toLowerCase()}`);
    funcoesCache.set(empresaId, s);
    return s;
  };

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2;
    const r = rows[i];
    const nomeEmp = r.empresa?.trim();
    if (!nomeEmp) {
      result.erros.push({ linha, mensagem: "empresa vazia" });
      continue;
    }
    try {
      let emp = empresaPorNome.get(nomeEmp.toLowerCase());
      if (!emp) {
        emp = await createEmpresa(nomeEmp);
        empresaPorNome.set(nomeEmp.toLowerCase(), emp);
        result.empresasCriadas++;
      } else {
        result.empresasReaproveitadas++;
      }

      const setorNome = r.setor?.trim();
      let setorId: string | null = null;
      if (setorNome) {
        const map = await ensureSetorMap(emp.id);
        const existing = map.get(setorNome.toLowerCase());
        if (existing) {
          setorId = existing;
        } else {
          const { data: novo, error } = await supabase
            .from("empresa_setores")
            .insert({ empresa_id: emp.id, nome: setorNome })
            .select("id")
            .single();
          if (error) throw error;
          setorId = novo!.id;
          map.set(setorNome.toLowerCase(), setorId);
          result.setoresCriados++;
        }
      }

      const funcaoNome = r.funcao?.trim();
      if (funcaoNome) {
        const set = await ensureFuncoesSet(emp.id);
        const key = `${setorId ?? "null"}|${funcaoNome.toLowerCase()}`;
        if (!set.has(key)) {
          const { error } = await supabase
            .from("empresa_funcoes")
            .insert({ empresa_id: emp.id, nome: funcaoNome, setor_id: setorId });
          if (error) throw error;
          set.add(key);
          result.funcoesCriadas++;
        }
      }
    } catch (err: any) {
      result.erros.push({ linha, mensagem: err?.message ?? String(err) });
    }
  }

  return result;
}
