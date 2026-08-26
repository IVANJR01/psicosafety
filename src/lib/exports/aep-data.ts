// =====================================================================
// AEP — Builder de dados consolidados para o Relatório Técnico Premium
// (PDF / Word / Excel). Mantém toda a regra de negócio em um único lugar.
// =====================================================================

import { DIMENSIONS, dimensionRiskScore, type Dimension } from "@/lib/copsoq";
import type { Resposta } from "@/lib/storage";
import type { Empresa } from "@/lib/empresas";

/** Respostas que possuem setor preenchido mas estão sem função/cargo. */
export function respostasSemFuncao(rs: Resposta[]): Resposta[] {
  return rs.filter((r) => (r.setor?.trim() || "") !== "" && (r.cargo?.trim() || "") === "");
}

// =====================================================================
// GES (Grupo de Exposição Similar) — chaveamento, formatação e validação
// =====================================================================
export const MSG_RELATORIO_GES_BLOQUEADO = "Relatório bloqueado: o agrupamento por GES não foi aplicado corretamente.";

function normalizarChaveGes(v: string): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Mapa { "<codigoEmpresa lower>|<setor normalizado>": "<ges>" }. */
export type GesMap = Record<string, string>;

export function gesMapKey(codigoEmpresa: string, setor: string): string {
  return `${(codigoEmpresa ?? "").trim().toLowerCase()}|${normalizarChaveGes(setor)}`;
}

export function lookupGes(codigoEmpresa: string, setor: string, gesMap?: GesMap): string | null {
  if (!gesMap) return null;
  const key = gesMapKey(codigoEmpresa, setor);
  const v = gesMap[key];
  if (v && v.trim()) return v.trim();

  // Fallback defensivo para dados antigos com chave sem normalização ou variação de caixa/acentos.
  const setorNorm = normalizarChaveGes(setor);
  const matches = Object.entries(gesMap).filter(([k]) => k.endsWith(`|${setorNorm}`));
  if (matches.length === 1) return matches[0][1]?.trim() || null;
  return null;
}

/** Formata "GES 08" (zero-padding 2 dígitos quando numérico). */
export function formatGes(ges: string | null | undefined): string {
  if (!ges) return "";
  const t = String(ges).trim();
  if (!t) return "";
  if (/^\d+$/.test(t)) return `GES ${t.padStart(2, "0")}`;
  return `GES ${t}`;
}

/** Rótulo "GES 08 — ALMOXARIFADO" (omite "GES …" quando ausente). */
export function formatSetorLabel(setor: string, ges?: string | null): string {
  const s = (setor ?? "").trim();
  const g = formatGes(ges);
  return g ? `${g} — ${s}` : s;
}

export type ValidacaoGes = {
  semGes: Array<{ codigo: string; setor: string }>;
  duplicados: Array<{ codigo: string; ges: string; setores: string[] }>;
};

/** Detecta respostas sem GES vinculado e GES duplicado em setores diferentes. */
export function validarSetorGes(respostas: Resposta[], gesMap?: GesMap): ValidacaoGes {
  const semGesSeen = new Set<string>();
  const semGes: ValidacaoGes["semGes"] = [];
  const dupMap = new Map<string, Set<string>>();
  respostas.forEach((r) => {
    const setor = r.setor?.trim();
    if (!setor) return;
    const codigo = (r.codigoEmpresa ?? "").trim();
    const ges = lookupGes(codigo, setor, gesMap);
    if (!ges) {
      const k = gesMapKey(codigo, setor);
      if (!semGesSeen.has(k)) { semGesSeen.add(k); semGes.push({ codigo, setor }); }
    } else {
      const k = `${codigo.toLowerCase()}|${formatGes(ges).toUpperCase()}`;
      if (!dupMap.has(k)) dupMap.set(k, new Set());
      dupMap.get(k)!.add(setor);
    }
  });
  const duplicados: ValidacaoGes["duplicados"] = [];
  dupMap.forEach((setores, k) => {
    if (setores.size > 1) {
      const [codigo, ges] = k.split("|");
      duplicados.push({ codigo, ges, setores: [...setores].sort() });
    }
  });
  return { semGes, duplicados };
}

/**
 * Abaixo deste número de respondentes o resultado não sustenta conclusão.
 *
 * O caso que motiva o corte é o mais perigoso do relatório: um domínio de
 * assédio pontuando 0% com três respondentes sai impresso como se dissesse
 * "não há assédio aqui". Não diz — diz que não há dado. E fica registrado num
 * documento da empresa, que vira prova contrária se alguém denunciar depois.
 *
 * Cinco é também o piso usual de anonimato em pesquisa organizacional: abaixo
 * disso, resultado por recorte começa a permitir identificar quem respondeu, o
 * que enfraquece a garantia de anonimato que o Guia do MTE pede (p. 10).
 */
export const MIN_RESPONDENTES_CONCLUSAO = 5;

/** O recorte tem respondentes suficientes para o resultado valer como conclusão? */
export function amostraSuficiente(n: number): boolean {
  return n >= MIN_RESPONDENTES_CONCLUSAO;
}

// ----- Probabilidade (1..5) baseada no % de respostas críticas -----
export function probabilidadeFromPct(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct >= 81) return 5;
  if (pct >= 61) return 4;
  if (pct >= 41) return 3;
  if (pct >= 21) return 2;
  return 1;
}

// Chance de ocorrência, não magnitude. Mesmo vocabulário do eixo da matriz
// 5x5 e da Escala de Probabilidade do AEP — se divergirem, o relatório volta a
// ter duas escalas para o mesmo número.
export const PROB_LABEL: Record<number, string> = {
  1: "Rara", 2: "Pouco provável", 3: "Possível", 4: "Provável", 5: "Muito provável",
};

// ----- Severidade por fator (1..5) — assédio/violência/discriminação = 5 -----
export const SEVERIDADE_FATOR: Record<string, 1 | 2 | 3 | 4 | 5> = {
  ofensivos: 5,   // assédio moral, sexual, violência, discriminação
  saude:     4,
  demandas:  3,
  interface: 3,
  relacoes:  2,
  organizacao: 2,
  "segurança": 3,
  seguranca: 3,
  reconhecimento: 2,
};

export const SEV_LABEL: Record<number, string> = {
  1: "Leve", 2: "Baixa", 3: "Moderada", 4: "Alta", 5: "Crítica",
};

// ----- Classificação Risco = P x S (Matriz 5x5 — NR-01 / AIHA / ISO 31000) -----
// Faixas oficiais (não-sobrepostas):
//   1–3  TRIVIAL       (verde claro)
//   4–8  TOLERÁVEL     (verde)
//   9–12 MODERADO      (amarelo)
//   13–15 SUBSTANCIAL  (laranja)
//   16–25 INTOLERÁVEL  (vermelho)
export type NivelRisco = "Baixo" | "Médio" | "Alto" | "Crítico";
export type Nivel5 = "TRIVIAL" | "TOLERÁVEL" | "MODERADO" | "SUBSTANCIAL" | "INTOLERÁVEL";

export type ClassRisco = {
  valor: number;
  nivel: NivelRisco;       // mantido p/ compatibilidade (interpretações por dimensão)
  nivel5: Nivel5;          // classificação oficial 5-níveis exibida no sistema
  cor: [number, number, number]; // RGB (cor oficial do nível 5)
  acao: string;
};

export const NIVEL5_COR: Record<Nivel5, [number, number, number]> = {
  TRIVIAL:     [134, 239, 172], // verde claro
  TOLERÁVEL:   [34, 197, 94],   // verde
  MODERADO:    [234, 179, 8],   // amarelo
  SUBSTANCIAL: [249, 115, 22],  // laranja
  INTOLERÁVEL: [220, 38, 38],   // vermelho
};

export const NIVEL5_FILL: Record<Nivel5, [number, number, number]> = {
  TRIVIAL:     [220, 252, 231],
  TOLERÁVEL:   [187, 247, 208],
  MODERADO:    [254, 249, 195],
  SUBSTANCIAL: [255, 237, 213],
  INTOLERÁVEL: [254, 226, 226],
};

export const NIVEL5_FAIXA: Record<Nivel5, string> = {
  TRIVIAL:     "1 - 3",
  TOLERÁVEL:   "4 - 8",
  MODERADO:    "9 - 12",
  SUBSTANCIAL: "13 - 15",
  INTOLERÁVEL: "16 - 25",
};

export function nivel5FromValor(v: number): Nivel5 {
  if (v <= 3)  return "TRIVIAL";
  if (v <= 8)  return "TOLERÁVEL";
  if (v <= 12) return "MODERADO";
  if (v <= 15) return "SUBSTANCIAL";
  return "INTOLERÁVEL";
}

// Mapeamento 5→4 para preservar textos interpretativos por dimensão
export function nivel4From5(n5: Nivel5): NivelRisco {
  if (n5 === "INTOLERÁVEL") return "Crítico";
  if (n5 === "SUBSTANCIAL") return "Alto";
  if (n5 === "MODERADO")    return "Médio";
  return "Baixo"; // TRIVIAL + TOLERÁVEL
}

// ----- Classificação Psicossocial pelo PERCENTUAL (não pela matriz P×S) -----
// Regra oficial do sistema:
//   0% – 33%   = Baixo
//   34% – 66%  = Médio
//   67% – 84%  = Alto
//   85% – 100% = Crítico
export function classifPsicoFromPct(pct: number): NivelRisco {
  if (pct >= 85) return "Crítico";
  if (pct >= 67) return "Alto";
  if (pct >= 34) return "Médio";
  return "Baixo";
}

export function classificarRisco(p: number, s: number): ClassRisco {
  const v = p * s;
  const n5 = nivel5FromValor(v);
  const nivel = nivel4From5(n5);
  const acaoMap: Record<Nivel5, string> = {
    TRIVIAL:     "Nenhuma ação necessária",
    TOLERÁVEL:   "Monitoramento",
    MODERADO:    "Controle adicional, se viável",
    SUBSTANCIAL: "Controle necessário",
    INTOLERÁVEL: "Ação imediata ou interrupção da atividade",
  };
  return { valor: v, nivel, nivel5: n5, cor: NIVEL5_COR[n5], acao: acaoMap[n5] };
}

// ----- Linha consolidada por fator psicossocial -----
export type LinhaFator = {
  dim: Dimension;
  scorePct: number;       // % geral de criticidade
  prob: number;           // 1..5
  sev: number;            // 1..5
  risco: ClassRisco;
  classifPsico: NivelRisco; // classificação psicossocial pelo percentual (independe da matriz P×S)
  n: number;              // respondentes
};


// ----- Linha por GES / Setores -----
export type FuncaoAgg = { funcao: string; n: number };
export type LinhaSetorAep = {
  setor: string;
  ges: string | null;            // GES vinculado (quando cadastrado)
  label: string;                 // "GES 08 — ALMOXARIFADO" ou apenas o nome
  codigoEmpresa: string;         // primeiro código de empresa do bucket
  n: number;
  funcoes: FuncaoAgg[];          // funções/cargos do setor com contagem
  fatores: LinhaFator[];
  fatorPrincipal: LinhaFator;    // fator de maior risco no setor
  riscoMaior: ClassRisco;        // maior risco do setor
};

// ----- Texto interpretativo automático (genérico, por nível) -----
export function textoInterpretacao(nivel: NivelRisco): string {
  switch (nivel) {
    case "Baixo":
      return "O fator avaliado apresentou resultado classificado como BAIXO. Recomenda-se manter o monitoramento periódico, preservar as boas práticas existentes e acompanhar possíveis alterações nas condições de trabalho.";
    case "Médio":
      return "O fator avaliado apresentou resultado classificado como MÉDIO. Recomenda-se elaborar medidas preventivas, acompanhar a evolução do indicador e incluir ações no planejamento do GRO/PGR, evitando agravamento do cenário.";
    case "Alto":
      return "O fator avaliado apresentou resultado classificado como ALTO. Recomenda-se priorizar ações preventivas e corretivas, definir responsáveis, prazos e indicadores de acompanhamento. O fator deve ser registrado no inventário de riscos e acompanhado no plano de ação.";
    case "Crítico":
      return "O fator avaliado apresentou resultado classificado como CRÍTICO. Recomenda-se adoção imediata de medidas de controle, investigação complementar, envolvimento da liderança, RH, SST e, quando necessário, profissionais especializados. Situações envolvendo assédio, violência ou dano grave devem seguir procedimento específico de apuração, proteção e encaminhamento.";
  }
}

// ----- Interpretação técnica profunda por fator (estilo consultoria) -----
// Combina o id da dimensão (COPSOQ) com o nível de risco para gerar
// um parágrafo técnico-executivo específico — não genérico.
//
// SEM USO no momento: o único consumidor era o gerador DOCX, removido por
// nunca ter sido alcançável. Mantido como conteúdo técnico aproveitável, com
// uma ressalva antes de religar: os textos de nível Baixo AFIRMAM ausência.
// O de `ofensivos` diz "Não foram identificados indícios relevantes de
// comportamentos ofensivos" — uma declaração de ausência de assédio que,
// impressa a partir de três respondentes, é exatamente o que o piso de
// MIN_RESPONDENTES_CONCLUSAO existe para impedir. Quem voltar a consumir este
// mapa precisa passar por amostraSuficiente() antes, como o PDF faz.
const INTERPRETACAO_FATOR: Record<string, Record<NivelRisco, string>> = {
  demandas: {
    Baixo: "Os indicadores apontam carga de trabalho percebida como compatível com os recursos disponíveis. Recomenda-se preservar o equilíbrio entre demandas quantitativas, cognitivas e emocionais, monitorando picos sazonais e mudanças organizacionais.",
    Médio: "Os resultados sinalizam percepção moderada de sobrecarga, com indícios de pressão temporal e acúmulo de tarefas em parte da população avaliada. Recomenda-se mapear gargalos por setor/função, revisar dimensionamento de equipe e definir critérios claros de priorização.",
    Alto: "Os resultados indicam percepção elevada de sobrecarga ocupacional, associada a excesso de demandas, pressão temporal e incompatibilidade entre exigências e recursos disponíveis. O cenário pode contribuir para fadiga mental, estresse ocupacional e aumento da probabilidade de afastamentos. Recomenda-se intervenção prioritária com redesenho de processos, redistribuição de carga e pactuação de metas realistas.",
    Crítico: "Os indicadores revelam sobrecarga ocupacional crítica, com forte risco de adoecimento mental, queda de produtividade e aumento expressivo de afastamentos. Recomenda-se ação imediata: revisão emergencial do dimensionamento, suspensão temporária de demandas não essenciais, avaliação clínica/ocupacional dos trabalhadores expostos e registro do fator com prioridade máxima no inventário do PGR.",
  },
  organizacao: {
    Baixo: "A organização do trabalho é percebida como clara, com autonomia adequada e papéis bem definidos. Manter práticas de comunicação, governança e participação dos trabalhadores nas decisões.",
    Médio: "Foram identificados sinais moderados de baixa autonomia, ambiguidade de papéis ou comunicação organizacional insuficiente. Recomenda-se revisar fluxos decisórios, clarificar responsabilidades e ampliar canais de escuta.",
    Alto: "Os resultados indicam fragilidade significativa na organização do trabalho, com percepção de baixa autonomia, falta de previsibilidade e ambiguidade de papéis. Esse cenário favorece estresse, ansiedade e desengajamento. Recomenda-se intervenção prioritária junto à liderança, com revisão de processos decisórios, descrições de cargo e governança.",
    Crítico: "A organização do trabalho apresenta-se crítica, com possível desorganização sistêmica, baixa autonomia e ausência de clareza de papéis em parcela relevante da população. Risco elevado de adoecimento coletivo e perda de talentos. Recomenda-se ação imediata da alta direção com plano de reestruturação organizacional acompanhado pelo SESMT/RH.",
  },
  relacoes: {
    Baixo: "As relações no ambiente de trabalho são percebidas como cooperativas e respeitosas, com bom suporte entre colegas e lideranças. Manter práticas de feedback, integração e desenvolvimento de liderança.",
    Médio: "Indícios moderados de fragilidade no suporte social, atritos pontuais ou falta de reconhecimento. Recomenda-se programas de desenvolvimento de liderança humanizada, mediação de conflitos e fortalecimento de cultura colaborativa.",
    Alto: "Os resultados apontam déficit relevante de apoio social no trabalho, com fragilidade no suporte de colegas e/ou lideranças, conflitos interpessoais e baixo reconhecimento. Esse cenário potencializa estresse, adoecimento mental e turnover. Recomenda-se intervenção prioritária com capacitação de lideranças, programas de reconhecimento e mediação estruturada de conflitos.",
    Crítico: "Cenário crítico de relações no trabalho, com forte percepção de ausência de apoio, conflitos não resolvidos e possível normalização de práticas inadequadas de liderança. Recomenda-se ação imediata: diagnóstico aprofundado por escuta qualificada, avaliação de denúncias e plano emergencial de desenvolvimento de lideranças.",
  },
  interface: {
    Baixo: "A interface trabalho-vida é percebida como saudável, com fronteiras respeitadas e baixa interferência do trabalho na vida pessoal. Manter políticas de desconexão e respeito a jornada.",
    Médio: "Sinais moderados de invasão do trabalho na vida pessoal (mensagens fora do expediente, dificuldade de desconectar). Recomenda-se formalizar política de desconexão e revisar práticas de comunicação assíncrona.",
    Alto: "Identificada percepção elevada de conflito trabalho-vida, com sobrecarga fora do expediente, dificuldade de desconexão e impacto sobre descanso e vida familiar. Risco aumentado de insônia, esgotamento e adoecimento. Recomenda-se intervenção prioritária com política formal de direito à desconexão, governança de jornada e revisão de práticas de liderança.",
    Crítico: "Conflito trabalho-vida em nível crítico, com forte invasão da vida pessoal pelo trabalho e potencial de adoecimento severo. Recomenda-se ação imediata: auditoria de jornada, suspensão de práticas de comunicação fora do expediente e plano de recuperação do equilíbrio trabalho-vida.",
  },
  saude: {
    Baixo: "Os indicadores de saúde, energia e sono apresentam-se estáveis. Manter ações de promoção da saúde mental, qualidade de vida e prevenção do esgotamento.",
    Médio: "Sinais moderados de fadiga, estresse persistente ou prejuízo no sono em parte da população. Recomenda-se ampliar ações de promoção da saúde mental, oferta de apoio psicológico e revisão de fatores organizacionais associados.",
    Alto: "Os resultados indicam comprometimento elevado da saúde mental e do bem-estar, com sinais de esgotamento, estresse persistente e prejuízo do sono. O cenário é compatível com risco aumentado de burnout, depressão e doenças psicossomáticas. Recomenda-se intervenção prioritária com programa de saúde mental, acesso facilitado a apoio psicológico e revisão das causas organizacionais.",
    Crítico: "Indicadores críticos de adoecimento mental coletivo, compatíveis com quadro de burnout instalado em parcela relevante dos trabalhadores. Recomenda-se ação imediata: avaliação clínica/ocupacional dos expostos, plano emergencial de saúde mental, revisão organizacional das causas e acompanhamento por equipe multiprofissional especializada.",
  },
  ofensivos: {
    Baixo: "Não foram identificados indícios relevantes de comportamentos ofensivos no recorte avaliado. Manter políticas de prevenção, canal de denúncias ativo e capacitação periódica conforme Lei 14.457/2022.",
    Médio: "Foram identificados indícios moderados de comportamentos ofensivos. Recomenda-se reforço imediato do canal de denúncias, comunicação institucional sobre tolerância zero e capacitação de lideranças.",
    Alto: "Os resultados indicam presença significativa de comportamentos ofensivos no ambiente de trabalho — possível assédio moral, sexual, violência e/ou discriminação. Cenário de alto impacto sobre saúde, dignidade e clima organizacional. Recomenda-se intervenção prioritária: apuração formal, proteção das pessoas envolvidas, comunicação institucional firme e plano estruturado de prevenção.",
    Crítico: "Cenário crítico com forte indicação de comportamentos ofensivos (assédio moral, assédio sexual, violência e/ou discriminação). Risco grave de adoecimento, judicialização e dano reputacional. Recomenda-se ação imediata da alta direção: apuração com sigilo e proteção das vítimas, medidas administrativas cabíveis, acionamento do Comitê/CIPA conforme Lei 14.457/2022 e plano corporativo de tolerância zero.",
  },
};

export function textoInterpretacaoFator(dimId: string, nivel: NivelRisco): string {
  return INTERPRETACAO_FATOR[dimId]?.[nivel] ?? textoInterpretacao(nivel);
}

// ----- Caracterização da exposição (duração / frequência / intensidade) -----
// Derivação técnica a partir da Probabilidade (1..5) e Severidade (1..5),
// alinhada ao Manual GRO/PGR (NR-01) — que exige caracterizar exposição
// considerando tempo, frequência e intensidade.
export function caracterizarExposicao(f: LinhaFator): {
  duracao: string;
  frequencia: string;
  intensidade: string;
  grupo: string;
} {
  const duracao =
    f.prob >= 4 ? "Contínua / habitual" :
    f.prob >= 3 ? "Prolongada"          :
    f.prob >= 2 ? "Intermitente"        : "Esporádica";
  const frequencia =
    f.prob >= 4 ? "Diária"                     :
    f.prob >= 3 ? "Várias vezes por semana"    :
    f.prob >= 2 ? "Semanal / mensal"           : "Eventual";
  const intensidade =
    f.sev >= 5 ? "Crítica"   :
    f.sev >= 4 ? "Alta"      :
    f.sev >= 3 ? "Moderada"  :
    f.sev >= 2 ? "Baixa"     : "Leve";
  const grupo = f.n > 0 ? `${f.n} trabalhador(es) avaliado(s)` : "—";
  return { duracao, frequencia, intensidade, grupo };
}

// ----- Medidas de prevenção existentes (estimativa por nível de risco) -----
// Quando não há dado registrado pela empresa, derivamos do nível de risco:
// risco crítico/alto → indica controle insuficiente; risco baixo → controles
// em operação. Coluna obrigatória no inventário segundo o Manual GRO/PGR.
export function medidasExistentesPadrao(nivel: NivelRisco): string {
  switch (nivel) {
    case "Baixo":   return "Existentes / eficazes";
    case "Médio":   return "Parciais — a fortalecer";
    case "Alto":    return "Insuficientes — a implementar";
    case "Crítico": return "Inexistentes / ineficazes";
  }
}

// ----- Caracterização genérica de atividades/ambientes por setor -----
// Texto descritivo curto para apoiar a seção "Caracterização das atividades
// e ambientes de trabalho" (exigida pelo Manual GRO/PGR — descrever processos,
// ambientes e atividades). Quando não há cadastro específico, derivamos do nome.
export function caracterizarAtividadesAmbiente(setor: string): {
  atividade: string;
  ambiente: string;
  organizacao: string;
} {
  const s = setor.toLowerCase();
  if (/admin|financ|rh|jurid|contab|fiscal/.test(s))
    return {
      atividade: "Atividades administrativas, analíticas e de gestão",
      ambiente: "Escritório / posto fixo / trabalho com tela",
      organizacao: "Jornada padrão; metas analíticas; comunicação interna intensa",
    };
  if (/atend|client|comerc|venda|sac|call|suporte/.test(s))
    return {
      atividade: "Atendimento, relacionamento e suporte a clientes",
      ambiente: "Posto fixo com tela e telefonia / contato contínuo com público",
      organizacao: "Metas, scripts, fila de atendimento, pressão temporal",
    };
  if (/oper|produc|fabr|manuten|logist|expedic|almox|armaz/.test(s))
    return {
      atividade: "Atividades operacionais, produtivas e logísticas",
      ambiente: "Planta / chão de fábrica / áreas operacionais",
      organizacao: "Turnos, ritmo cadenciado, EPIs, metas de produção",
    };
  if (/ti|tecnolog|dev|infra|sistem|dados/.test(s))
    return {
      atividade: "Desenvolvimento, sustentação e gestão de tecnologia",
      ambiente: "Trabalho com tela / remoto ou híbrido",
      organizacao: "Sprints, plantão/on-call, comunicação assíncrona",
    };
  if (/lid|gest|diret|coord|gerenc|superv/.test(s))
    return {
      atividade: "Gestão de pessoas, decisão e governança",
      ambiente: "Múltiplos contextos / reuniões / deslocamentos",
      organizacao: "Responsabilidade ampliada, jornada elástica, pressão por resultado",
    };
  return {
    atividade: "Atividades inerentes ao setor avaliado",
    ambiente: "Posto de trabalho conforme rotina do setor",
    organizacao: "Organização do trabalho conforme práticas vigentes da empresa",
  };
}

// ----- Fatores específicos derivados (nomenclatura MTE / NR-01 / GRO-PGR) -----
// As categorias COPSOQ continuam a estrutura analítica do questionário e dos
// cálculos. No PDF técnico (inventário, exposição, plano de ação) usamos a
// nomenclatura específica esperada em auditoria — derivada de cada categoria.
export type FatorEspecifico = { nome: string; dano: string };

export const FATORES_ESPECIFICOS: Record<string, FatorEspecifico[]> = {
  demandas: [
    { nome: "Excesso de demandas no trabalho", dano: "Estresse ocupacional, fadiga mental" },
    { nome: "Sobrecarga de trabalho",         dano: "Exaustão emocional, risco de burnout" },
    { nome: "Pressão temporal",                dano: "Ansiedade, erros operacionais" },
    { nome: "Metas excessivas",                dano: "Sofrimento psíquico, adoecimento" },
  ],
  organizacao: [
    { nome: "Baixa autonomia",                          dano: "Desmotivação, estresse crônico" },
    { nome: "Falta de clareza de função",               dano: "Ambiguidade de papel, ansiedade" },
    { nome: "Má gestão de mudanças organizacionais",   dano: "Insegurança, resistência, conflito" },
    { nome: "Baixa previsibilidade",                    dano: "Insegurança, estresse crônico" },
    { nome: "Comunicação deficiente",                   dano: "Retrabalho, conflitos, erro humano" },
  ],
  relacoes: [
    { nome: "Falta de suporte da liderança",     dano: "Desengajamento, sofrimento psíquico" },
    { nome: "Baixo apoio social",                 dano: "Isolamento, adoecimento mental" },
    { nome: "Conflitos interpessoais",            dano: "Estresse, queda de produtividade" },
    { nome: "Baixa justiça organizacional",       dano: "Desmotivação, turnover" },
    { nome: "Baixa recompensa e reconhecimento", dano: "Desmotivação, sofrimento psíquico" },
  ],
  interface: [
    { nome: "Conflito trabalho-família / desequilíbrio trabalho-vida", dano: "Insônia, esgotamento, conflito familiar" },
    { nome: "Insegurança no emprego / organizacional",                  dano: "Ansiedade, estresse crônico" },
    { nome: "Desequilíbrio esforço-recompensa",                         dano: "Desmotivação, adoecimento" },
    { nome: "Excesso de demandas no trabalho (sobrecarga)",             dano: "Transtorno mental; DORT" },
  ],
  saude: [
    { nome: "Sofrimento psíquico relacionado ao trabalho", dano: "Transtornos mentais (CID-F)" },
    { nome: "Estresse ocupacional",                         dano: "Doenças psicossomáticas, afastamentos" },
    { nome: "Exaustão emocional",                           dano: "Burnout, incapacidade laboral" },
    { nome: "Burnout relacionado ao trabalho (CID-11 QD85)", dano: "Esgotamento profissional, afastamento prolongado" },
  ],
  ofensivos: [
    { nome: "Assédio moral",         dano: "Dano psicológico grave, judicialização" },
    { nome: "Violência psicológica", dano: "Trauma, transtornos mentais" },
    { nome: "Discriminação",          dano: "Sofrimento, dano à dignidade, passivo legal" },
    { nome: "Assédio sexual",         dano: "Dano grave — obrigação legal Lei 14.457/2022" },
  ],
};

// ----- Descrição FIXA dos domínios (linguagem MTE / executiva) -----
export const DESCRICAO_DOMINIO: Record<string, string> = {
  demandas:    "Carga, ritmo e exigências emocionais.",
  organizacao: "Autonomia, sentido do trabalho, previsibilidade e organização das atividades.",
  relacoes:    "Apoio social, liderança, reconhecimento e relacionamento interpessoal.",
  interface:   "Equilíbrio trabalho-família, segurança, estabilidade e integração indivíduo-trabalho.",
  saude:       "Estresse ocupacional, fadiga, exaustão emocional e saúde psicológica.",
  ofensivos:   "Assédio moral, violência psicológica, discriminação e comportamentos abusivos.",
};

// ----- Biblioteca FIXA de possíveis agravos por fator específico (Guia MTE) -----
// NUNCA livre: a IA apenas seleciona desta lista; não inventa diagnósticos.
export const AGRAVOS_FIXOS: Record<string, string> = {
  // demandas
  "Excesso de demandas no trabalho": "Transtornos mentais; DORT",
  "Sobrecarga de trabalho":           "Transtornos mentais; fadiga ocupacional",
  "Pressão temporal":                  "Ansiedade; transtornos mentais",
  "Metas excessivas":                  "Sofrimento psíquico; transtornos mentais",
  // organizacao
  "Baixa autonomia":                          "Transtornos mentais",
  "Falta de clareza de função":               "Ansiedade; transtornos mentais",
  "Má gestão de mudanças organizacionais":    "Insegurança; transtornos mentais",
  "Baixa previsibilidade":                    "Transtornos mentais",
  "Comunicação deficiente":                   "Ansiedade; conflitos interpessoais",
  // relacoes
  "Falta de suporte da liderança":     "Transtornos mentais",
  "Baixo apoio social":                 "Isolamento social; transtornos mentais",
  "Conflitos interpessoais":            "Transtornos mentais",
  "Baixa justiça organizacional":       "Sofrimento psíquico; transtornos mentais",
  "Baixa recompensa e reconhecimento":  "Sofrimento psíquico; transtornos mentais",
  // interface
  "Conflito trabalho-família / desequilíbrio trabalho-vida": "Insônia; transtornos mentais",
  "Insegurança no emprego / organizacional":                  "Ansiedade; transtornos mentais",
  "Desequilíbrio esforço-recompensa":                         "Sofrimento psíquico; transtornos mentais",
  "Excesso de demandas no trabalho (sobrecarga)":              "Transtorno mental; DORT",
  // saude
  "Sofrimento psíquico relacionado ao trabalho": "Transtornos mentais (CID-F)",
  "Estresse ocupacional":                         "Transtornos mentais; doenças psicossomáticas",
  "Exaustão emocional":                           "Burnout; transtornos mentais",
  "Burnout relacionado ao trabalho (CID-11 QD85)": "Exaustão emocional; transtornos mentais",
  // ofensivos
  "Assédio moral":         "Sofrimento psíquico; transtornos mentais",
  "Violência psicológica": "Trauma emocional; transtornos mentais",
  "Discriminação":          "Sofrimento psíquico; transtornos mentais",
  "Assédio sexual":         "Trauma emocional; transtornos mentais",
};

export function agravosPara(nomeFator: string): string {
  return AGRAVOS_FIXOS[nomeFator] ?? "Transtornos mentais";
}

// =====================================================================
// MAPEAMENTO OBRIGATÓRIO — Guia de Fatores de Riscos Psicossociais (MTE)
// Questionário psicossocial → Agente/Situação → Perigo (fator de risco) → Possível agravo
// O sistema NÃO inventa: o agravo só pode vir desta tabela.
// =====================================================================
export type MteFator = {
  dominio: string;        // Domínio avaliado
  agente: string;         // Agente / situação relacionada
  perigo: string;         // Perigo (fator de risco) — nomenclatura MTE
  consequencia: string;   // Possível consequência (lesão / agravo) — Guia MTE
};

export const MTE_MAPA: MteFator[] = [
  { dominio: "Demandas no Trabalho", agente: "Sobrecarga, pressão, múltiplas tarefas, ritmo intenso", perigo: "Excesso de demandas no trabalho (sobrecarga)", consequencia: "Transtorno mental; DORT" },
  { dominio: "Demandas no Trabalho", agente: "Monotonia, baixa atividade, subutilização", perigo: "Baixa demanda no trabalho (subcarga)", consequencia: "Transtorno mental" },
  { dominio: "Controle sobre o Trabalho", agente: "Pouca autonomia, baixo poder de decisão, baixo controle da tarefa", perigo: "Baixo controle no trabalho / Falta de autonomia", consequencia: "Transtorno mental; DORT" },
  { dominio: "Relações Sociais e Liderança", agente: "Conflitos, ambiente hostil, relações deterioradas", perigo: "Más relações no local de trabalho", consequencia: "Transtorno mental" },
  { dominio: "Comportamentos Ofensivos", agente: "Assédio moral, assédio sexual, humilhações, intimidação, discriminação", perigo: "Assédio de qualquer natureza no trabalho", consequencia: "Transtorno mental" },
  { dominio: "Reconhecimento e Recompensa", agente: "Falta de valorização, ausência de reconhecimento, recompensas inadequadas", perigo: "Baixas recompensas e reconhecimento", consequencia: "Transtorno mental" },
  { dominio: "Organização do Trabalho", agente: "Comunicação deficiente, falhas no fluxo de informação, ruído organizacional", perigo: "Trabalho em condições de difícil comunicação", consequencia: "Transtorno mental" },
  { dominio: "Interface Trabalho-Indivíduo", agente: "Interferência das demandas do trabalho na vida pessoal, com consumo de tempo e energia pessoal", perigo: "Excesso de demandas no trabalho (sobrecarga)", consequencia: "Transtorno mental; DORT" },
  { dominio: "Justiça Organizacional", agente: "Percepção de injustiça, tratamento desigual, decisões não transparentes", perigo: "Baixa justiça organizacional", consequencia: "Transtorno mental" },
  { dominio: "Clareza de Papel / Função", agente: "Funções mal definidas, conflito de papéis, ambiguidade de responsabilidades", perigo: "Baixa clareza de papel / função", consequencia: "Transtorno mental" },
  { dominio: "Gestão Organizacional", agente: "Mudanças sem planejamento, comunicação inadequada sobre mudanças", perigo: "Má gestão de mudanças organizacionais", consequencia: "Transtorno mental; DORT" },
  { dominio: "Apoio Social / Apoio da Gestão", agente: "Falta de suporte da liderança, falta de apoio dos colegas, ausência de acolhimento", perigo: "Falta de suporte / apoio no trabalho", consequencia: "Transtorno mental" },
  { dominio: "Eventos Críticos", agente: "Agressões, ameaças, exposição a eventos críticos ou traumáticos", perigo: "Eventos violentos ou traumáticos", consequencia: "Transtorno mental" },
  { dominio: "Segurança no Trabalho", agente: "Percepção de insegurança ocupacional, falhas na comunicação preventiva, ausência de confiança nas condições de trabalho, deficiência na gestão preventiva", perigo: "Trabalho em condições de difícil comunicação / Falhas na gestão da segurança do trabalho", consequencia: "Transtorno mental; estresse ocupacional; insegurança psicossocial" },
  { dominio: "Reconhecimento e Justiça", agente: "Falta de reconhecimento profissional, percepção de injustiça organizacional, tratamento desigual, baixa valorização, ausência de feedback e recompensas inadequadas", perigo: "Baixas recompensas e reconhecimento / Baixa justiça organizacional", consequencia: "Transtorno mental; estresse ocupacional; sofrimento psíquico relacionado ao trabalho" },
  /*
   * Os dois itens abaixo existem para que "Interface Trabalho-Indivíduo" e
   * "Saúde e Bem-estar" parem de reaproveitar o perigo de sobrecarga
   * (MTE_MAPA[0]).
   *
   * O reaproveitamento produzia linha incoerente no Inventário: o Domínio dizia
   * uma coisa e o Agente/Perigo descreviam outra. Quem lê o PGR vê "Saúde e
   * bem-estar" inteiramente descrito como sobrecarga, sem explicação.
   *
   * Acrescentados no FIM do array de propósito: MTE_POR_DIM referencia por
   * índice, então inserir no meio deslocaria todos os mapeamentos existentes.
   */
  { dominio: "Interface Trabalho-Indivíduo", agente: "Interferência das demandas do trabalho na vida pessoal, com consumo de tempo e energia pessoal", perigo: "Interferência do trabalho na vida pessoal (conflito trabalho-família)", consequencia: "Transtorno mental; fadiga; sofrimento psíquico relacionado ao trabalho" },
  { dominio: "Saúde e Bem-estar", agente: "Indicadores de desgaste referidos pelos trabalhadores — estresse, exaustão, problemas de sono e queda de bem-estar percebido", perigo: "Desgaste da saúde mental relacionado ao trabalho", consequencia: "Transtorno mental; estresse ocupacional; esgotamento profissional" },
];

// Mapeia o id de dimensão COPSOQ deste sistema para o(s) item(ns) MTE.
// Para domínios COPSOQ amplos, o índice principal é o primeiro; em risco
// elevado podemos ainda exibir o secundário (ex.: demandas → sobrecarga/subcarga).
export const MTE_POR_DIM: Record<string, MteFator[]> = {
  demandas:    [MTE_MAPA[0], MTE_MAPA[1]],
  organizacao: [MTE_MAPA[2], MTE_MAPA[6], MTE_MAPA[9], MTE_MAPA[10]],
  relacoes:    [MTE_MAPA[3], MTE_MAPA[11], MTE_MAPA[5]],
  interface:   [MTE_MAPA[15], MTE_MAPA[8]],
  saude:       [MTE_MAPA[16]],
  ofensivos:   [MTE_MAPA[4], MTE_MAPA[12]],
  "segurança":    [MTE_MAPA[13]],
  seguranca:      [MTE_MAPA[13]],
  reconhecimento: [MTE_MAPA[14]],
  justica:        [MTE_MAPA[14]],
};

// Item MTE principal por domínio + nível (escolhe o mais grave em risco alto)
export function mteParaDim(dimId: string, _nivel?: NivelRisco): MteFator {
  const arr = MTE_POR_DIM[dimId] ?? [];
  if (arr.length > 0) return arr[0];
  // Fallback por palavra-chave no slug/título (caso o DB use slug diferente)
  const key = (dimId || "").toLowerCase();
  if (key.includes("segur")) return MTE_MAPA[13];
  if (key.includes("reconhec") || key.includes("justi")) return MTE_MAPA[14];
  if (key.includes("demand")) return MTE_MAPA[0];
  if (key.includes("organiz") || key.includes("control") || key.includes("autonom")) return MTE_MAPA[2];
  if (key.includes("rela") || key.includes("lideran") || key.includes("apoio")) return MTE_MAPA[3];
  if (key.includes("interface") || key.includes("vida")) return MTE_MAPA[15];
  if (key.includes("saud") || key.includes("bem")) return MTE_MAPA[16];
  if (key.includes("ofens") || key.includes("ass") || key.includes("viol")) return MTE_MAPA[4];
  return { dominio: dimId, agente: "—", perigo: "—", consequencia: "Transtorno mental" };
}

// ----- Resultado identificado por domínio (fator específico dominante) -----
// Escolhe o fator específico mais representativo do domínio com base no nível
// de risco apurado: quanto mais alto o risco, mais grave o fator escolhido.
export function resultadoIdentificado(dimId: string, nivel: NivelRisco): { nome: string; dano: string } {
  const lista = FATORES_ESPECIFICOS[dimId] ?? [];
  if (lista.length === 0) return { nome: "—", dano: "—" };
  // Crítico/Alto → primeiro item (geralmente o mais grave da lista);
  // Médio → segundo; Baixo → último (manutenção).
  let idx = 0;
  if (nivel === "Médio") idx = Math.min(1, lista.length - 1);
  else if (nivel === "Baixo") idx = lista.length - 1;
  const escolhido = lista[idx];
  return { nome: escolhido.nome, dano: agravosPara(escolhido.nome) };
}

// ----- Classificação das medidas existentes (NR-01 / GRO-PGR) -----
export type EfetividadeMedida = "Inexistente" | "Insuficiente" | "Parcial" | "Adequada" | "Eficaz";

export function efetividadeMedidas(nivel: NivelRisco): EfetividadeMedida {
  switch (nivel) {
    case "Crítico": return "Inexistente";
    case "Alto":    return "Insuficiente";
    case "Médio":   return "Parcial";
    case "Baixo":   return "Eficaz";
  }
}

export function necessidadeMelhoria(nivel: NivelRisco): string {
  switch (nivel) {
    case "Crítico": return "Implementação imediata";
    case "Alto":    return "Implementação prioritária";
    case "Médio":   return "Aprimoramento programado";
    case "Baixo":   return "Manutenção / monitoramento";
  }
}

export function alertaEspecial(nomeFator: string): string {
  return `[ ! ] ALERTA ESPECIAL - ${nomeFator}. Foram identificados indícios que exigem atenção institucional imediata. Considerando o potencial de dano à saúde, à integridade, à dignidade e ao ambiente de trabalho, a empresa deve tratar o fator com prioridade máxima, sigilo, proteção das pessoas envolvidas e adoção de medidas institucionais adequadas (apuração formal, acompanhamento clínico/psicossocial, comunicação institucional e registro no PGR).`;
}

// ----- GES cadastrados (todos os GES registrados, com ou sem avaliação) -----
export type GesCadastradoSetor = { setor: string; avaliado: boolean };
export type GesCadastrado = {
  ges: string;                      // valor cru, ex.: "01"
  gesFormatado: string;             // "GES 01"
  label: string;                    // "GES 01 — FINANCEIRO / PCP / RH"
  setores: GesCadastradoSetor[];    // todos os setores vinculados ao GES
  avaliado: boolean;                // true se ≥ 1 setor teve resposta
  totalRespostas: number;           // soma das respostas dos setores do GES
  justificativa?: string;           // justificativa preenchida pelo técnico (quando sem avaliação)
};

// ----- Responsável Técnico (obrigatório para o relatório final) -----
export type ResponsavelTecnico = {
  nome: string;
  formacao: string;
  registro: string;
  cargo?: string;
  dataEmissao?: string;
};

// ----- Estrutura final consolidada -----
export type AepDataset = {
  empresa: Empresa | null;
  empresaNome: string;
  setorFiltro: string;        // "Todos" ou nome
  campanhaNome: string;       // "Todas" ou nome
  periodo: { inicio?: string; fim?: string };
  responsavelTecnico: string;
  responsavelTec?: ResponsavelTecnico;
  emitidoEm: string;
  totalRespostas: number;
  totalConvidados?: number;   // para taxa de participação
  taxaParticipacao?: number;  // 0-100
  // Totais de trabalhadores para o relatório técnico (anti-fiscalização)
  totaisTrabalhadores?: {
    cadastrados?: number;     // total cadastrado na empresa
    abrangidos?: number;      // total nos GES avaliados
  };
  fatoresGerais: LinhaFator[];
  setores: LinhaSetorAep[];
  top10: LinhaFator[];
  setorMaisCritico?: LinhaSetorAep;
  contagemNiveis: Record<NivelRisco, number>;
  imp: { score: number; nivel: "Saudável" | "Atenção" | "Vulnerável" | "Crítico"; cor: [number, number, number]; emoji: string };
  // GES cadastrados — incluem todos os GES do sistema, mesmo sem avaliação
  gesCadastrados: GesCadastrado[];
  gesAvaliados: GesCadastrado[];
  gesSemAvaliacao: GesCadastrado[];
  // Marca o PDF como rascunho (marca d'água "RASCUNHO — NÃO VÁLIDO PARA FISCALIZAÇÃO")
  rascunho?: boolean;
};

export function assertAgrupamentoGesAplicado(data: AepDataset): void {
  const linhas = data.setores ?? [];
  if (linhas.length === 0) return;
  const semGesOuRotulo = linhas.some((s) => !s.ges || !/^GES\s+/i.test(s.label));
  const gesVistos = new Set<string>();
  const gesDuplicado = linhas.some((s) => {
    const k = `${s.codigoEmpresa.toLowerCase()}|${formatGes(s.ges).toUpperCase()}`;
    if (!k) return true;
    if (gesVistos.has(k)) return true;
    gesVistos.add(k);
    return false;
  });
  if (semGesOuRotulo || gesDuplicado) throw new Error(MSG_RELATORIO_GES_BLOQUEADO);
}

// ----- Índice de Maturidade Psicossocial (0-100) -----
// 100 = ambiente saudável; 0 = ambiente crítico. Baseado na média ponderada
// do valor de risco (P×S) dos fatores avaliados.
export function calcularIMP(fatores: LinhaFator[]): AepDataset["imp"] {
  const validos = fatores.filter((f) => f.n > 0);
  if (validos.length === 0) {
    return { score: 100, nivel: "Saudável", cor: [0, 184, 148], emoji: "🟢" };
  }
  const media = validos.reduce((a, f) => a + f.risco.valor, 0) / validos.length;
  // 1 = melhor, 25 = pior → score 100..0
  const score = Math.max(0, Math.min(100, Math.round(100 - ((media - 1) / 24) * 100)));
  if (score >= 80) return { score, nivel: "Saudável",   cor: [0, 184, 148],   emoji: "🟢" };
  if (score >= 60) return { score, nivel: "Atenção",    cor: [253, 203, 110], emoji: "🟡" };
  if (score >= 40) return { score, nivel: "Vulnerável", cor: [225, 112, 85],  emoji: "🟠" };
  return            { score, nivel: "Crítico",    cor: [214, 48, 49],   emoji: "🔴" };
}

export function buildAepDataset(opts: {
  empresa: Empresa | null;
  empresaNome: string;
  setorFiltro: string;
  campanhaNome: string;
  periodo?: { inicio?: string; fim?: string };
  responsavelTecnico: string;
  responsavelTec?: ResponsavelTecnico;
  totalConvidados?: number;
  respostas: Resposta[];
  gesPorSetor?: GesMap;
  agruparPorGes?: boolean;
  /** Todos os GES cadastrados no sistema (filtrados pela empresa do recorte). */
  gesCadastrados?: Array<{ codigoEmpresa: string; setor: string; ges: string }>;
  /** Justificativa textual por GES (chave = gesFormatado, ex.: "GES 14"). */
  justificativasSemAvaliacao?: Record<string, string>;
  /** Total de trabalhadores cadastrados na empresa (anti-fiscalização). */
  totalTrabalhadoresCadastrados?: number;
  /** Total de trabalhadores abrangidos pelos GES avaliados. */
  totalTrabalhadoresAbrangidos?: number;
  /** Marca o PDF como rascunho (marca d'água, sem validade fiscal). */
  rascunho?: boolean;
  /** Quando informado, bloqueia montagem do dataset com respostas fora do recorte selecionado. */
  escopoSetorialPermitido?: Array<{ nome: string; ges?: string | null }>;
  /**
   * Estrutura do instrumento contra a qual pontuar. Omitida, usa a versão
   * carregada no global — comportamento correto enquanto existe uma só versão.
   *
   * Ao pontuar respostas de uma versão que não é a vigente, o chamador precisa
   * informar a estrutura daquela versão (ver `dimensoesDaVersao`), senão os
   * códigos de `answers` não encontram pergunta nenhuma e tudo zera.
   */
  dimensoes?: Dimension[];
}): AepDataset {
  const respostas = opts.respostas;
  const agruparPorGes = opts.agruparPorGes ?? true;
  const dims = opts.dimensoes ?? DIMENSIONS;

  /*
   * Um relatório cobre UMA versão do instrumento.
   *
   * Misturar não é questão de implementação, é de sentido: não se tira média
   * entre "Demandas no trabalho" de um instrumento e "Exigências quantitativas"
   * de outro — são construtos diferentes, medidos por perguntas diferentes.
   * Um AEP que somasse as duas produziria número sem significado, e ninguém
   * lendo o PDF teria como perceber.
   *
   * Por isso interrompe em vez de escolher sozinho: a decisão de qual recorte
   * emitir é de quem assina o documento.
   */
  const versoesPresentes = new Set(
    respostas.map((r) => r.versaoId).filter((v): v is string => !!v),
  );
  if (versoesPresentes.size > 1) {
    throw new Error(
      `O recorte selecionado mistura ${versoesPresentes.size} versões do questionário. ` +
        "Escores de instrumentos diferentes não podem ser somados. " +
        "Selecione uma campanha ou período que use uma única versão.",
    );
  }

  const escopoSetorialPermitido = opts.escopoSetorialPermitido ?? [];
  if (escopoSetorialPermitido.length > 0) {
    const nomesPermitidos = new Set(
      escopoSetorialPermitido.map((s) => normalizarChaveGes(s.nome)).filter(Boolean),
    );
    const gesPermitidos = new Set(
      escopoSetorialPermitido.map((s) => formatGes(s.ges).toUpperCase()).filter(Boolean),
    );
    const foraEscopo = respostas.filter((r) => {
      const setor = r.setor?.trim() ?? "";
      const setorOk = nomesPermitidos.size > 0 && nomesPermitidos.has(normalizarChaveGes(setor));
      const ges = lookupGes(r.codigoEmpresa, setor, opts.gesPorSetor);
      const gesOk = nomesPermitidos.size === 0 && !!ges && gesPermitidos.has(formatGes(ges).toUpperCase());
      return !(setorOk || gesOk);
    });
    if (foraEscopo.length > 0) {
      const setores = [...new Set(foraEscopo.map((r) => r.setor?.trim()).filter(Boolean))].join(", ");
      const err: any = new Error("O relatório de reavaliação está tentando incluir setores fora do escopo da campanha.");
      err.code = "ESCOPO_REAVALIACAO_INVALIDO";
      err.setoresForaEscopo = setores;
      throw err;
    }
  }

  // Validação obrigatória: nenhuma resposta com setor preenchido pode estar sem função
  const pendentes = respostasSemFuncao(respostas);
  if (pendentes.length > 0) {
    const setoresAfetados = [...new Set(pendentes.map((r) => r.setor.trim()))].join(", ");
    const amostraIds = pendentes.slice(0, 5).map((r) => r.id).join(", ");
    const err: any = new Error(
      `${pendentes.length} resposta(s) do setor "${setoresAfetados}" estão sem função vinculada. ` +
      `Abra Admin → Respostas, filtre por esse setor e edite cada resposta para informar a função/cargo. ` +
      `IDs de exemplo: ${amostraIds}${pendentes.length > 5 ? "…" : ""}.`,
    );
    err.code = "FUNCAO_OBRIGATORIA";
    err.pendentes = pendentes;
    throw err;
  }

  // Respostas sem setor preenchido não podem ser agrupadas por GES.
  if (agruparPorGes) {
    const semSetor = respostas.filter((r) => !(r.setor?.trim()));
    if (semSetor.length > 0) {
      const amostraIds = semSetor.slice(0, 5).map((r) => r.id).join(", ");
      const err: any = new Error(
        `${semSetor.length} resposta(s) estão sem setor preenchido e não podem ser agrupadas por GES. ` +
        `Abra Admin → Respostas, filtre por "sem setor" e edite cada resposta informando o setor (e a função). ` +
        `IDs de exemplo: ${amostraIds}${semSetor.length > 5 ? "…" : ""}.`,
      );
      err.code = "SETOR_OBRIGATORIO";
      err.pendentes = semSetor;
      throw err;
    }
  }

  const validacaoGes = validarSetorGes(respostas, opts.gesPorSetor);
  if (agruparPorGes && validacaoGes.semGes.length > 0) {
    const setoresLista = validacaoGes.semGes
      .slice(0, 5)
      .map((x) => `"${x.setor}"${x.codigo ? ` (${x.codigo})` : ""}`)
      .join(", ");
    const err: any = new Error(
      `${validacaoGes.semGes.length} setor(es) sem GES cadastrado: ${setoresLista}` +
      `${validacaoGes.semGes.length > 5 ? "…" : ""}. ` +
      `Abra Admin → Setores e vincule cada setor acima a um GES antes de exportar o AEP.`,
    );
    err.code = "AGRUPAMENTO_GES_INVALIDO";
    err.semGes = validacaoGes.semGes;
    throw err;
  }


  // Fatores gerais
  const fatoresGerais: LinhaFator[] = dims.map((d) => {
    const scores = respostas.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
    const scorePct = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const prob = probabilidadeFromPct(scorePct);
    const sev = SEVERIDADE_FATOR[d.id] ?? 3;
    return { dim: d, scorePct, prob, sev, n: scores.length, risco: classificarRisco(prob, sev), classifPsico: classifPsicoFromPct(scorePct) };
  });

  // Mapa de setores cadastrados por GES formatado (exibir o GES com TODOS os
  // setores vinculados — o agrupamento é por GES, não por setor isolado).
  const setoresPorGesFormatado = new Map<string, string[]>();
  (opts.gesCadastrados ?? []).forEach((row) => {
    const setor = row.setor?.trim();
    const ges = row.ges?.trim();
    if (!setor || !ges) return;
    const gf = formatGes(ges);
    const arr = setoresPorGesFormatado.get(gf) ?? [];
    if (!arr.some((s) => normalizarChaveGes(s) === normalizarChaveGes(setor))) arr.push(setor);
    setoresPorGesFormatado.set(gf, arr);
  });

  // Setores — agrupados por (empresa + setor) ou (empresa + GES) quando solicitado
  type Bucket = { setoresNomes: Set<string>; ges: string | null; codigoEmpresa: string; items: Resposta[] };
  const buckets = new Map<string, Bucket>();
  respostas.forEach((r) => {
    const setor = r.setor?.trim() || "(Sem setor)";
    const codigo = (r.codigoEmpresa ?? "").trim();
    const ges = lookupGes(codigo, setor, opts.gesPorSetor);
    const gesKey = formatGes(ges).toUpperCase();
    const key = agruparPorGes && gesKey
      ? `${codigo.toLowerCase()}|GES|${gesKey}`
      : `${codigo.toLowerCase()}|S|${setor.toUpperCase()}`;
    let b = buckets.get(key);
    if (!b) { b = { setoresNomes: new Set(), ges, codigoEmpresa: codigo, items: [] }; buckets.set(key, b); }
    b.setoresNomes.add(setor);
    b.items.push(r);
  });
  const setores: LinhaSetorAep[] = [];
  buckets.forEach((b) => {
    const arr = b.items;
    const fatores: LinhaFator[] = dims.map((d) => {
      const scores = arr.map((r) => dimensionRiskScore(d, r.answers)).filter((v) => v > 0);
      const scorePct = scores.length ? Math.round(scores.reduce((a, b2) => a + b2, 0) / scores.length) : 0;
      const prob = probabilidadeFromPct(scorePct);
      const sev = SEVERIDADE_FATOR[d.id] ?? 3;
      return { dim: d, scorePct, prob, sev, n: scores.length, risco: classificarRisco(prob, sev), classifPsico: classifPsicoFromPct(scorePct) };
    });
    const fatoresValidos = fatores.filter((f) => f.n > 0);
    const fatorPrincipal = (fatoresValidos.length ? fatoresValidos : fatores)
      .reduce((a, b2) => (b2.risco.valor > a.risco.valor ? b2 : a));
    const riscoMaior = fatorPrincipal.risco;
    const funcMap = new Map<string, number>();
    arr.forEach((r) => {
      const f = r.cargo?.trim();
      if (!f) return;
      funcMap.set(f, (funcMap.get(f) ?? 0) + 1);
    });
    const funcoes: FuncaoAgg[] = [...funcMap.entries()]
      .map(([funcao, n]) => ({ funcao, n }))
      .sort((a, b2) => b2.n - a.n);
    // Quando agrupado por GES, exibir TODOS os setores cadastrados naquele GES,
    // mesmo os sem resposta neste ciclo. O GES é avaliado como um todo.
    const gesFmt = formatGes(b.ges);
    const setoresCadastrados = agruparPorGes && gesFmt
      ? (setoresPorGesFormatado.get(gesFmt) ?? [...b.setoresNomes])
      : [...b.setoresNomes];
    const setorJoin = [...new Set([...setoresCadastrados, ...b.setoresNomes])]
      .sort((x, y) => x.localeCompare(y, "pt-BR"))
      .join(" / ");
    setores.push({
      setor: setorJoin,
      ges: b.ges,
      label: formatSetorLabel(setorJoin, b.ges),
      codigoEmpresa: b.codigoEmpresa,
      n: arr.length, funcoes, fatores, fatorPrincipal, riscoMaior,
    });
  });
  setores.sort((a, b) => {
    const ga = Number(String(a.ges ?? "").replace(/\D/g, ""));
    const gb = Number(String(b.ges ?? "").replace(/\D/g, ""));
    if (Number.isFinite(ga) && Number.isFinite(gb) && ga !== gb) return ga - gb;
    return a.label.localeCompare(b.label, "pt-BR", { numeric: true });
  });

  // Top 10 fatores (combina geral + por setor para obter mais críticos)
  const todos: LinhaFator[] = [
    ...fatoresGerais,
    ...setores.flatMap((s) => s.fatores.map((f) => ({ ...f, dim: { ...f.dim, title: `${f.dim.title} — ${s.label}` } }))),
  ].filter((f) => f.n > 0);
  const top10 = [...todos].sort((a, b) => b.risco.valor - a.risco.valor || b.scorePct - a.scorePct).slice(0, 10);

  const contagem: Record<NivelRisco, number> = { Baixo: 0, Médio: 0, Alto: 0, Crítico: 0 };
  fatoresGerais.forEach((f) => { if (f.n > 0) contagem[f.risco.nivel] += 1; });
  setores.forEach((s) => s.fatores.forEach((f) => { if (f.n > 0) contagem[f.risco.nivel] += 1; }));

  const taxa = opts.totalConvidados && opts.totalConvidados > 0
    ? Math.min(100, Math.round((respostas.length / opts.totalConvidados) * 100))
    : undefined;

  // -------- GES cadastrados (todos os GES do sistema) --------
  // Conjunto de chaves "<codigoEmpresa lower>|<setor normalizado>" com pelo menos uma resposta.
  const setoresAvaliadosSet = new Set<string>();
  respostas.forEach((r) => {
    const setor = r.setor?.trim();
    if (!setor) return;
    setoresAvaliadosSet.add(gesMapKey((r.codigoEmpresa ?? "").trim(), setor));
  });
  // Agrupa todos os GES cadastrados por gesFormatado
  const gesAgg = new Map<string, GesCadastrado>();
  (opts.gesCadastrados ?? []).forEach((row) => {
    const setor = row.setor?.trim();
    const ges = row.ges?.trim();
    if (!setor || !ges) return;
    const gesFormatado = formatGes(ges);
    let g = gesAgg.get(gesFormatado);
    if (!g) {
      g = { ges, gesFormatado, label: gesFormatado, setores: [], avaliado: false, totalRespostas: 0 };
      gesAgg.set(gesFormatado, g);
    }
    const avaliado = setoresAvaliadosSet.has(gesMapKey((row.codigoEmpresa ?? "").trim(), setor));
    if (!g.setores.some((x) => normalizarChaveGes(x.setor) === normalizarChaveGes(setor))) {
      g.setores.push({ setor, avaliado });
    }
  });
  const respostasPorChave = new Map<string, number>();
  respostas.forEach((r) => {
    const setor = r.setor?.trim();
    if (!setor) return;
    const k = gesMapKey((r.codigoEmpresa ?? "").trim(), setor);
    respostasPorChave.set(k, (respostasPorChave.get(k) ?? 0) + 1);
  });
  const gesCadastrados: GesCadastrado[] = [...gesAgg.values()].map((g) => {
    const setoresOrd = [...g.setores].sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
    const avaliado = setoresOrd.some((s) => s.avaliado);
    const total = setoresOrd.reduce((acc, s) => {
      // soma respostas dos setores; precisa código de empresa - tenta usar primeiro código disponível
      return acc + (opts.gesCadastrados ?? [])
        .filter((r) => normalizarChaveGes(r.setor) === normalizarChaveGes(s.setor) && formatGes(r.ges) === g.gesFormatado)
        .reduce((a, r) => a + (respostasPorChave.get(gesMapKey((r.codigoEmpresa ?? "").trim(), s.setor)) ?? 0), 0);
    }, 0);
    return {
      ...g,
      setores: setoresOrd,
      avaliado,
      totalRespostas: total,
      label: `${g.gesFormatado} — ${setoresOrd.map((s) => s.setor).join(" / ")}`,
    };
  }).sort((a, b) => {
    const na = Number(String(a.ges).replace(/\D/g, ""));
    const nb = Number(String(b.ges).replace(/\D/g, ""));
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.label.localeCompare(b.label, "pt-BR", { numeric: true });
  });
  // Aplica justificativas informadas pelo técnico (chave = gesFormatado)
  const justMap = opts.justificativasSemAvaliacao ?? {};
  gesCadastrados.forEach((g) => {
    const j = justMap[g.gesFormatado] || justMap[g.gesFormatado.toUpperCase()];
    if (j && j.trim()) g.justificativa = j.trim();
  });
  const gesAvaliados = gesCadastrados.filter((g) => g.avaliado);
  const gesSemAvaliacao = gesCadastrados.filter((g) => !g.avaliado);

  const dataset: AepDataset = {
    empresa: opts.empresa,
    empresaNome: /todas as empresas/i.test(opts.empresaNome) ? "Consolidado Geral" : opts.empresaNome,
    setorFiltro: opts.setorFiltro,
    campanhaNome: opts.campanhaNome,
    periodo: opts.periodo ?? {},
    responsavelTecnico: opts.responsavelTecnico,
    responsavelTec: opts.responsavelTec,
    emitidoEm: new Date().toLocaleString("pt-BR"),
    totalRespostas: respostas.length,
    totalConvidados: opts.totalConvidados,
    taxaParticipacao: taxa,
    totaisTrabalhadores: {
      cadastrados: opts.totalTrabalhadoresCadastrados,
      abrangidos: opts.totalTrabalhadoresAbrangidos,
    },
    rascunho: opts.rascunho ?? false,
    fatoresGerais,
    setores,
    top10,
    setorMaisCritico: [...setores].sort((a, b) => b.riscoMaior.valor - a.riscoMaior.valor)[0],
    contagemNiveis: contagem,
    imp: calcularIMP(fatoresGerais),
    gesCadastrados,
    gesAvaliados,
    gesSemAvaliacao,
  };

  if (agruparPorGes) assertAgrupamentoGesAplicado(dataset);
  return dataset;
}
