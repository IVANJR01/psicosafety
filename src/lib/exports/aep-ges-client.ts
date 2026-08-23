import { supabase } from "@/integrations/supabase/client";
import { gesMapKey, type GesMap } from "./aep-data";

export type GesCadastradoRow = { codigoEmpresa: string; setor: string; ges: string };
type EmpresaGesRef = { id?: string | null; codigo?: string | null };

export async function carregarGesCadastradosDoModuloSetores(
  empresas: EmpresaGesRef[],
  codigoEmpresa?: string,
): Promise<{ gesMap: GesMap; rows: GesCadastradoRow[] }> {
  let empresasFonte = codigoEmpresa
    ? empresas.filter((e) => String(e.codigo ?? "").trim() === codigoEmpresa)
    : empresas;

  if (codigoEmpresa && empresasFonte.length === 0) {
    const { data, error } = await supabase
      .from("empresas")
      .select("id, codigo")
      .eq("codigo", codigoEmpresa)
      .maybeSingle();
    if (error) throw error;
    empresasFonte = data ? [data] : [];
  }

  const ids = empresasFonte.map((e) => e.id).filter(Boolean) as string[];
  if (ids.length === 0) return { gesMap: {}, rows: [] };

  const { data, error } = await supabase
    .from("empresa_setores")
    .select("empresa_id, nome, ges")
    .in("empresa_id", ids)
    .eq("status", "active")
    .not("ges", "is", null)
    .order("nome");
  if (error) throw error;

  const empresaById = new Map(empresasFonte.map((e) => [e.id, String(e.codigo ?? "").trim()]));
  const gesMap: GesMap = {};
  const rows: GesCadastradoRow[] = [];
  (data ?? []).forEach((row: any) => {
    const codigo = empresaById.get(row.empresa_id);
    const setor = String(row.nome ?? "").trim();
    const ges = String(row.ges ?? "").trim();
    if (!codigo || !setor || !ges) return;
    gesMap[gesMapKey(codigo, setor)] = ges;
    rows.push({ codigoEmpresa: codigo, setor, ges });
  });

  return { gesMap, rows };
}