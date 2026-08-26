// Questionário baseado no COPSOQ III (versão curta) — adaptado para PT-BR.
// As perguntas vivem no banco (tabelas `questionario_dimensoes`, `questionario_perguntas`,
// `questionario_opcoes`) e podem ser editadas no admin. Este módulo mantém uma
// cópia em memória sincronizada via `loadDimensions()` para que telas existentes
// (relatórios, gráficos) continuem usando o array `DIMENSIONS` como antes.

import { supabase } from "@/integrations/supabase/client";

export type LikertOption = { value: number; label: string };

export const LIKERT_FREQ: LikertOption[] = [
  { value: 5, label: "Sempre" },
  { value: 4, label: "Frequentemente" },
  { value: 3, label: "Às vezes" },
  { value: 2, label: "Raramente" },
  { value: 1, label: "Nunca / Quase nunca" },
];

export const LIKERT_GRAU: LikertOption[] = [
  { value: 5, label: "Em grande medida" },
  { value: 4, label: "Em larga medida" },
  { value: 3, label: "De certa forma" },
  { value: 2, label: "Em pequena medida" },
  { value: 1, label: "Em muito pequena medida" },
];

export type Question = {
  id: string;
  text: string;
  scale: LikertOption[];
  reverse?: boolean;
};

export type Dimension = {
  id: string;
  title: string;
  description: string;
  questions: Question[];
};

// Seed default (espelho do banco). Permite que telas renderizem antes do fetch
// concluir e funciona como fallback se o banco estiver indisponível.
const DEFAULT_DIMENSIONS: Dimension[] = [
  {
    id: "demandas",
    title: "Demandas no trabalho",
    description: "Carga, ritmo e exigências emocionais.",
    questions: [
      { id: "d1", text: "A sua carga de trabalho se acumula porque você não consegue dar conta?", scale: LIKERT_FREQ },
      { id: "d2", text: "Você tem que trabalhar muito rapidamente?", scale: LIKERT_FREQ },
      { id: "d3", text: "Seu trabalho exige que você esconda os seus sentimentos?", scale: LIKERT_FREQ },
      { id: "d4", text: "Seu trabalho é emocionalmente desgastante?", scale: LIKERT_FREQ },
    ],
  },
  {
    id: "organizacao",
    title: "Organização e conteúdo do trabalho",
    description: "Autonomia, sentido e previsibilidade.",
    questions: [
      { id: "o1", text: "Você tem influência sobre o que faz no seu trabalho?", scale: LIKERT_GRAU, reverse: true },
      { id: "o2", text: "Seu trabalho tem um sentido para você?", scale: LIKERT_GRAU, reverse: true },
      { id: "o3", text: "Você recebe com antecedência as informações necessárias para fazer bem o seu trabalho?", scale: LIKERT_FREQ, reverse: true },
      { id: "o4", text: "Você pode decidir quando fazer uma pausa?", scale: LIKERT_FREQ, reverse: true },
    ],
  },
  {
    id: "relacoes",
    title: "Relações sociais e liderança",
    description: "Apoio de colegas, chefia e clareza de papéis.",
    questions: [
      { id: "r1", text: "Você recebe ajuda e apoio dos seus colegas quando precisa?", scale: LIKERT_FREQ, reverse: true },
      { id: "r2", text: "Sua chefia imediata dá prioridade ao bem-estar dos trabalhadores?", scale: LIKERT_GRAU, reverse: true },
      { id: "r3", text: "Sua chefia é boa em planejar o trabalho?", scale: LIKERT_GRAU, reverse: true },
      { id: "r4", text: "Você sabe exatamente o que se espera de você no trabalho?", scale: LIKERT_GRAU, reverse: true },
    ],
  },
  {
    id: "interface",
    title: "Interface trabalho-indivíduo",
    description: "Satisfação e conflito trabalho-vida.",
    questions: [
      { id: "i1", text: "Quão satisfeito você está com o seu trabalho de uma forma geral?", scale: [
        { value: 5, label: "Muito satisfeito" },
        { value: 4, label: "Satisfeito" },
        { value: 3, label: "Neutro" },
        { value: 2, label: "Insatisfeito" },
        { value: 1, label: "Muito insatisfeito" },
      ], reverse: true },
      { id: "i2", text: "Você sente que o trabalho consome energia que faria falta para a vida pessoal?", scale: LIKERT_FREQ },
      { id: "i3", text: "Você sente que o trabalho exige tempo que faria falta para a vida pessoal?", scale: LIKERT_FREQ },
    ],
  },
  {
    id: "saude",
    title: "Saúde e bem-estar",
    description: "Estresse, esgotamento e sono.",
    questions: [
      { id: "s1", text: "Com que frequência você se sente estressado(a)?", scale: LIKERT_FREQ },
      { id: "s2", text: "Com que frequência você se sente esgotado(a) emocionalmente?", scale: LIKERT_FREQ },
      { id: "s3", text: "Com que frequência você dorme mal por causa do trabalho?", scale: LIKERT_FREQ },
      { id: "s4", text: "De forma geral, como você considera sua saúde?", scale: [
        { value: 5, label: "Excelente" },
        { value: 4, label: "Muito boa" },
        { value: 3, label: "Boa" },
        { value: 2, label: "Razoável" },
        { value: 1, label: "Ruim" },
      ], reverse: true },
    ],
  },
  {
    id: "ofensivos",
    title: "Comportamentos ofensivos",
    description: "Assédio moral, sexual e violência no trabalho.",
    questions: [
      { id: "of1", text: "Você foi exposto(a) a humilhação ou ridicularização no trabalho nos últimos 12 meses?", scale: LIKERT_FREQ },
      { id: "of2", text: "Você sofreu assédio moral (perseguição, ameaças) no trabalho nos últimos 12 meses?", scale: LIKERT_FREQ },
      { id: "of3", text: "Você sofreu assédio sexual no trabalho nos últimos 12 meses?", scale: LIKERT_FREQ },
      { id: "of4", text: "Você sofreu violência física no trabalho nos últimos 12 meses?", scale: LIKERT_FREQ },
    ],
  },
];

// Array exportado e MUTÁVEL — telas síncronas continuam funcionando.
// É reescrito in-place após cada `loadDimensions()` para refletir o banco.
export const DIMENSIONS: Dimension[] = DEFAULT_DIMENSIONS.map((d) => ({
  ...d,
  questions: d.questions.map((q) => ({ ...q })),
}));

export let ALL_QUESTIONS: Question[] = DIMENSIONS.flatMap((d) => d.questions);

let loadPromise: Promise<Dimension[]> | null = null;
let loaded = false;

function applyDimensions(next: Dimension[]) {
  DIMENSIONS.splice(0, DIMENSIONS.length, ...next);
  ALL_QUESTIONS = DIMENSIONS.flatMap((d) => d.questions);
}

/**
 * Busca a estrutura de uma versão no banco. Não toca em DIMENSIONS.
 *
 * `somenteAtivas` separa dois usos que parecem o mesmo e não são:
 *
 * - montar o questionário que será respondido → só o que está ativo, porque
 *   `ativo` é justamente o que decide se a pergunta vai para a tela;
 * - pontuar respostas já dadas → TUDO da versão, ativo ou não. Uma versão
 *   aposentada tem todas as perguntas desativadas, e ainda assim as respostas
 *   coletadas sob ela precisam ser lidas. Filtrar por `ativo` aqui zeraria o
 *   histórico inteiro no dia em que uma versão saísse de circulação.
 */
async function buscarEstrutura(
  versaoId: string | null,
  somenteAtivas: boolean,
): Promise<Dimension[]> {
  let dimQuery = supabase
    .from("questionario_dimensoes")
    .select("id,slug,titulo,descricao,ordem,ativo,versao_id");
  if (somenteAtivas) dimQuery = dimQuery.eq("ativo", true);
  if (versaoId) dimQuery = dimQuery.eq("versao_id", versaoId);

  let qsQuery = supabase
    .from("questionario_perguntas")
    .select("id,dimensao_id,codigo,texto,escala,reverse,ordem,ativo");
  if (somenteAtivas) qsQuery = qsQuery.eq("ativo", true);

  const [dimsRes, qsRes, opsRes] = await Promise.all([
    dimQuery.order("ordem"),
    qsQuery.order("ordem"),
    supabase.from("questionario_opcoes").select("pergunta_id,valor,rotulo,ordem").order("ordem"),
  ]);
  if (dimsRes.error || qsRes.error || opsRes.error) {
    throw dimsRes.error || qsRes.error || opsRes.error;
  }

  const opsByPergunta = new Map<string, LikertOption[]>();
  for (const o of opsRes.data ?? []) {
    const arr = opsByPergunta.get(o.pergunta_id) ?? [];
    arr.push({ value: o.valor, label: o.rotulo });
    opsByPergunta.set(o.pergunta_id, arr);
  }

  return (dimsRes.data ?? []).map((d) => ({
    id: d.slug,
    title: d.titulo,
    description: d.descricao,
    questions: (qsRes.data ?? [])
      .filter((q) => q.dimensao_id === d.id)
      .map((q) => {
        const scale =
          q.escala === "freq" ? LIKERT_FREQ :
          q.escala === "grau" ? LIKERT_GRAU :
          (opsByPergunta.get(q.id) ?? []).sort((a, b) => b.value - a.value);
        return { id: q.codigo, text: q.texto, scale, reverse: q.reverse } satisfies Question;
      }),
  }));
}

const cacheVersoes = new Map<string, Dimension[]>();

/**
 * Estrutura de uma versão específica, SEM mexer no DIMENSIONS global.
 *
 * DIMENSIONS é um vetor único que `applyDimensions` sobrescreve no lugar, então
 * só existe uma estrutura viva por vez em toda a aplicação. Pontuar respostas de
 * versões diferentes exige que duas coexistam — daí esta função devolver a
 * estrutura em vez de instalá-la.
 */
export async function dimensoesDaVersao(versaoId: string): Promise<Dimension[]> {
  const emCache = cacheVersoes.get(versaoId);
  if (emCache) return emCache;
  const dims = await buscarEstrutura(versaoId, false);
  cacheVersoes.set(versaoId, dims);
  return dims;
}

/**
 * Carrega a estrutura do questionário de UMA versão do instrumento.
 *
 * O filtro por versão não é detalhe: o banco guarda todas as versões lado a
 * lado para que respostas antigas continuem sendo pontuadas pela estrutura em
 * que foram dadas. Sem o filtro, carregar "tudo que está ativo" traria as
 * dimensões de duas versões somadas — o questionário apareceria com o dobro
 * de blocos e os escores misturariam instrumentos diferentes.
 *
 * Sem `versaoId`, usa a versão vigente. Bancos anteriores ao versionamento não
 * têm a tabela nem a coluna: nesse caso cai no comportamento antigo, de
 * carregar todas as dimensões ativas.
 */
export async function loadDimensions(force = false, versaoId?: string): Promise<Dimension[]> {
  if (!force && loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      let versao = versaoId ?? null;
      if (!versao) {
        const { data } = await supabase
          .from("questionario_versoes")
          .select("id")
          .eq("vigente", true)
          .maybeSingle();
        versao = data?.id ?? null;
      }

      const next = await buscarEstrutura(versao, true);

      if (next.length > 0) applyDimensions(next);
      loaded = true;
      return DIMENSIONS;
    } catch (e) {
      console.warn("[copsoq] falha ao carregar do banco, usando padrão:", e);
      return DIMENSIONS;
    }
  })();
  return loadPromise;
}

export function dimensionsLoaded() { return loaded; }

export type Answers = Record<string, number>;

export function dimensionRiskScore(dim: Dimension, answers: Answers): number {
  const vals = dim.questions
    .map((q) => {
      const v = answers[q.id];
      if (!v) return null;
      const risk = q.reverse ? 6 - v : v;
      return ((risk - 1) / 4) * 100;
    })
    .filter((x): x is number => x !== null);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function riskLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Crítico", color: "destructive" };
  if (score >= 50) return { label: "Alto", color: "warning" };
  if (score >= 30) return { label: "Moderado", color: "primary" };
  return { label: "Baixo", color: "success" };
}
