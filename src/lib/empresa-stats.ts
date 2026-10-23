import { DIMENSIONS, dimensionRiskScore, type Dimension } from "./copsoq";
import { severidadeFromScore, type Severidade } from "./recomendacoes";
import {
  SEVERIDADE_DIM,
  faixaPxS,
  probFromScorePct,
  severidadeDaDimensao,
  type Nivel,
} from "./risco-matriz";
import type { Resposta } from "./storage";

// `Nivel` e `SEVERIDADE_DIM` eram redefinidos aqui — cópia idêntica da de
// `risco-matriz.ts`. Re-exportados para não quebrar quem já importa deste
// módulo; a definição passa a ser uma só.
export { SEVERIDADE_DIM, type Nivel };

export function probFromScore(score: number): Nivel {
  return probFromScorePct(score);
}

// Mesma faixa de `risco-matriz.classifyRisco`, em hexadecimal para os
// gráficos. Antes os cortes (>=16, >=13, >=9, >=4) estavam escritos de novo
// aqui; agora vêm de `faixaPxS` e só as cores pertencem a este módulo.
const COR_FAIXA: Record<ReturnType<typeof faixaPxS>, string> = {
  INTOLERÁVEL: "#dc2626",
  SUBSTANCIAL: "#f97316",
  MODERADO: "#eab308",
  TOLERÁVEL: "#22c55e",
  TRIVIAL: "#86efac",
};

export function classifyRisco(p: Nivel, s: Nivel) {
  const r = p * s;
  const label = faixaPxS(r);
  return { nivel: r, label, color: COR_FAIXA[label] };
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
    const sev = severidadeDaDimensao(d.id);
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
