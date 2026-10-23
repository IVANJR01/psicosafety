// FONTE ÚNICA da classificação de risco psicossocial (matriz 5×5 — NR-01).
//
// Severidade por dimensão, probabilidade pelo percentual e a faixa de P×S
// moravam em TRÊS arquivos ao mesmo tempo: aqui, em `empresa-stats.ts` e em
// `exports/aep-data.ts`. Os valores coincidiam, mas nada garantia isso — e a
// deriva já tinha acontecido: builds publicados fora do Git traziam
// `organizacao: 3` e `relacoes: 3` onde este arquivo diz 2.
//
// Pior que a tabela duplicada era o DEFAULT divergente. Uma dimensão fora da
// tabela recebia severidade 2 na tela da empresa e 3 no relatório do admin —
// a mesma dimensão, dois níveis de risco diferentes, no mesmo produto. É o
// caso de qualquer questionário cujos slugs não estejam listados abaixo.
//
// Agora os outros dois módulos importam daqui. Para mudar uma severidade,
// muda-se neste arquivo e em nenhum outro.

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

/**
 * Severidade de uma dimensão desconhecida.
 *
 * 3 (moderada), não 2: o slug vem do banco (`questionario_dimensoes.slug`), e
 * um questionário pode trazer dimensões que esta tabela não conhece. Diante da
 * dúvida, num documento de segurança do trabalho, não se subestima.
 */
export const SEVERIDADE_PADRAO: Nivel = 3;

/** Severidade da dimensão, com o default único aplicado. */
export function severidadeDaDimensao(dimId: string): Nivel {
  return SEVERIDADE_DIM[dimId] ?? SEVERIDADE_PADRAO;
}

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

export type FaixaPxS = "TRIVIAL" | "TOLERÁVEL" | "MODERADO" | "SUBSTANCIAL" | "INTOLERÁVEL";

/**
 * Faixa da matriz 5×5 — NR-01 / AIHA / ISO 31000, faixas não-sobrepostas:
 *   1–3 TRIVIAL · 4–8 TOLERÁVEL · 9–12 MODERADO · 13–15 SUBSTANCIAL · 16–25 INTOLERÁVEL
 *
 * Os cortes ficam SÓ aqui. Estavam repetidos em `empresa-stats.classifyRisco`
 * e em `aep-data.nivel5FromValor`; eram iguais por coincidência mantida à mão.
 */
export function faixaPxS(valor: number): FaixaPxS {
  if (valor >= 16) return "INTOLERÁVEL";
  if (valor >= 13) return "SUBSTANCIAL";
  if (valor >= 9) return "MODERADO";
  if (valor >= 4) return "TOLERÁVEL";
  return "TRIVIAL";
}

// Apresentação em classes Tailwind (telas). A variante em hexadecimal, para
// gráficos, fica em `empresa-stats.classifyRisco` — mesma faixa, outro meio.
const ESTILO_FAIXA: Record<FaixaPxS, { cls: string; soft: string }> = {
  INTOLERÁVEL: { cls: "bg-destructive text-destructive-foreground", soft: "bg-destructive/15 text-destructive border border-destructive/30" },
  SUBSTANCIAL: { cls: "bg-orange-500 text-white", soft: "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30" },
  MODERADO: { cls: "bg-yellow-400 text-yellow-950", soft: "bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30" },
  TOLERÁVEL: { cls: "bg-emerald-500 text-white", soft: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30" },
  TRIVIAL: { cls: "bg-emerald-300 text-emerald-950", soft: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/30" },
};

export function classifyRisco(p: Nivel, s: Nivel) {
  const r = p * s;
  const label = faixaPxS(r);
  return { nivel: r, label, ...ESTILO_FAIXA[label] };
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
