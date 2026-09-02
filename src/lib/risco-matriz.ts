// Helpers compartilhados de classificação de risco (matriz 5x5 NR-01 / AIHA)
// Escala padronizada: 1–4 BAIXO, 5–9 MÉDIO, 10–16 ALTO, 17–25 CRÍTICO.

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

export const DIM_META: Record<string, { agente: string; danos: string }> = {
  demandas: {
    agente: "Excesso de demandas no trabalho",
    danos: "Transtorno mental; DORT; estresse ocupacional; fadiga mental",
  },
  organizacao: {
    agente: "Baixo controle no trabalho / Falta de autonomia",
    danos: "Transtorno mental; DORT; ansiedade",
  },
  relacoes: {
    agente: "Más relações no local de trabalho / Falta de apoio",
    danos: "Transtorno mental; conflitos interpessoais; DORT",
  },
  interface: {
    agente: "Conflito trabalho-vida / Sobrecarga fora do expediente",
    danos: "Transtorno mental; insônia; esgotamento",
  },
  saude: {
    agente: "Estresse, esgotamento e prejuízo ao sono",
    danos: "Burnout; depressão; doenças psicossomáticas",
  },
  ofensivos: {
    agente: "Assédio moral, sexual e violência no trabalho",
    danos: "Transtorno mental grave; estresse pós-traumático; afastamento",
  },
  "segurança": {
    agente: "Percepção de insegurança ocupacional / falhas na gestão da segurança do trabalho",
    danos: "Transtorno mental; estresse ocupacional; insegurança psicossocial",
  },
  seguranca: {
    agente: "Percepção de insegurança ocupacional / falhas na gestão da segurança do trabalho",
    danos: "Transtorno mental; estresse ocupacional; insegurança psicossocial",
  },
  reconhecimento: {
    agente: "Falta de reconhecimento profissional / percepção de injustiça organizacional",
    danos: "Transtorno mental; estresse ocupacional; sofrimento psíquico relacionado ao trabalho",
  },
};

export function probFromScorePct(pct: number): Nivel {
  if (pct >= 81) return 5;
  if (pct >= 61) return 4;
  if (pct >= 41) return 3;
  if (pct >= 21) return 2;
  return 1;
}

// Matriz 5x5 oficial (NR-01 / AIHA / ISO 31000) — faixas não-sobrepostas:
//   1–3 TRIVIAL • 4–8 TOLERÁVEL • 9–12 MODERADO • 13–15 SUBSTANCIAL • 16–25 INTOLERÁVEL
export function classifyRisco(p: Nivel, s: Nivel) {
  const r = p * s;
  if (r >= 16) return { nivel: r, label: "INTOLERÁVEL", cls: "bg-destructive text-destructive-foreground", soft: "bg-destructive/15 text-destructive border border-destructive/30" };
  if (r >= 13) return { nivel: r, label: "SUBSTANCIAL", cls: "bg-orange-500 text-white", soft: "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30" };
  if (r >= 9)  return { nivel: r, label: "MODERADO", cls: "bg-yellow-400 text-yellow-950", soft: "bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30" };
  if (r >= 4)  return { nivel: r, label: "TOLERÁVEL", cls: "bg-emerald-500 text-white", soft: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" };
  return { nivel: r, label: "TRIVIAL", cls: "bg-emerald-300 text-emerald-950", soft: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/30" };
}

import type { DIMENSIONS } from "./copsoq";
export type ApuLinha = {
  dim: typeof DIMENSIONS[number];
  score: number;
  prob: Nivel;
  sev: Nivel;
  risco: ReturnType<typeof classifyRisco>;
  n: number;
};

export type LinhaSetor = {
  setor: string;
  n: number;
  porDim: { dimId: string; dimTitle: string; score: number; sev: import("./recomendacoes").Severidade }[];
};
