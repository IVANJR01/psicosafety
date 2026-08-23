import { DIMENSIONS, dimensionRiskScore, type Dimension } from "./copsoq";
import { severidadeFromScore, type Severidade } from "./recomendacoes";
import type { Resposta } from "./storage";

export type Nivel = 1 | 2 | 3 | 4 | 5;

export const SEVERIDADE_DIM: Record<string, Nivel> = {
  ofensivos: 5,
  saude: 4,
  demandas: 3,
  interface: 3,
  relacoes: 2,
  organizacao: 2,
  "segurança": 3,
  seguranca: 3,
  reconhecimento: 2,
};

export function probFromScore(score: number): Nivel {
  if (score >= 81) return 5;
  if (score >= 61) return 4;
  if (score >= 41) return 3;
  if (score >= 21) return 2;
  return 1;
}

// Matriz 5x5 oficial (NR-01 / AIHA / ISO 31000) — faixas não-sobrepostas:
//   1–3 TRIVIAL • 4–8 TOLERÁVEL • 9–12 MODERADO • 13–15 SUBSTANCIAL • 16–25 INTOLERÁVEL
export function classifyRisco(p: Nivel, s: Nivel) {
  const r = p * s;
  if (r >= 16) return { nivel: r, label: "INTOLERÁVEL" as const, color: "#dc2626" };
  if (r >= 13) return { nivel: r, label: "SUBSTANCIAL" as const, color: "#f97316" };
  if (r >= 9)  return { nivel: r, label: "MODERADO"   as const, color: "#eab308" };
  if (r >= 4)  return { nivel: r, label: "TOLERÁVEL"  as const, color: "#22c55e" };
  return         { nivel: r, label: "TRIVIAL"    as const, color: "#86efac" };
}

export type DimAgg = {
  dim: Dimension;
  score: number;
  severidade: Severidade;
  prob: Nivel;
  sev: Nivel;
  risco: ReturnType<typeof classifyRisco>;
  n: number;
};

export function aggregateDimensions(respostas: Resposta[]): DimAgg[] {
  return DIMENSIONS.map((d) => {
    const scores = respostas.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
    const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const sev = SEVERIDADE_DIM[d.id] ?? 2;
    const prob = probFromScore(score);
    return {
      dim: d,
      score,
      severidade: severidadeFromScore(score),
      prob,
      sev,
      risco: classifyRisco(prob, sev),
      n: scores.length,
    };
  });
}

export type SetorRow = {
  setor: string;
  n: number;
  porDim: { dimId: string; dimTitle: string; score: number }[];
};

export function aggregateBySetor(respostas: Resposta[]): SetorRow[] {
  const buckets = new Map<string, Resposta[]>();
  respostas.forEach((r) => {
    const k = r.setor || "(sem setor)";
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  });
  const out: SetorRow[] = [];
  buckets.forEach((arr, setor) => {
    const porDim = DIMENSIONS.map((d) => {
      const scores = arr.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
      const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { dimId: d.id, dimTitle: d.title, score };
    });
    out.push({ setor, n: arr.length, porDim });
  });
  return out.sort((a, b) => a.setor.localeCompare(b.setor));
}

export function distribSeveridade(respostas: Resposta[]) {
  // % de dimensões em cada nível, considerando média geral por dim
  const aggs = aggregateDimensions(respostas);
  const counts: Record<Severidade, number> = { baixo: 0, moderado: 0, alto: 0, critico: 0 };
  aggs.forEach((a) => { if (a.n > 0) counts[a.severidade]++; });
  return [
    { name: "Baixo", value: counts.baixo, color: "#10b981" },
    { name: "Moderado", value: counts.moderado, color: "#3b82f6" },
    { name: "Alto", value: counts.alto, color: "#f59e0b" },
    { name: "Crítico", value: counts.critico, color: "#ef4444" },
  ];
}

export function colorForScore(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#3b82f6";
  return "#10b981";
}
