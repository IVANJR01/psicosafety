// Banco de recomendações de medidas de controle por dimensão COPSOQ.
// Aplicáveis ao plano de ação da NR-01 (gerenciamento de riscos psicossociais).
//
// REGRA DESTE ARQUIVO: a AEP não cria programa, treinamento, comissão, política
// ou pesquisa por padrão. Uma medida só entra quando age sobre a condição de
// trabalho identificada, ou quando existe exigência legal — e, nesse caso, o
// detalhe cita a base. O plano imprime as DUAS primeiras ações de cada faixa,
// então a ordem aqui é a ordem de prioridade, e as duas primeiras precisam
// resistir à pergunta "por que essa medida foi recomendada?".

export type Acao = {
  titulo: string;
  detalhe: string;
  prazo: "Imediato" | "Curto prazo (até 30 dias)" | "Médio prazo (até 90 dias)" | "Longo prazo (até 180 dias)";
};

export type RecomendacaoDim = {
  dimId: string;
  acoes: {
    baixo: Acao[];      // 0-29
    moderado: Acao[];   // 30-49
    alto: Acao[];       // 50-69
    critico: Acao[];    // 70-100
  };
};

export const RECOMENDACOES: RecomendacaoDim[] = [
  {
    dimId: "demandas",
    acoes: {
      baixo: [
        { titulo: "Monitorar carga de trabalho", detalhe: "Manter pesquisa periódica e acompanhar indicadores de absenteísmo.", prazo: "Médio prazo (até 90 dias)" },
      ],
      moderado: [
        { titulo: "Revisar dimensionamento da equipe", detalhe: "Mapear processos do GES / Setores e avaliar se o quadro é compatível com a demanda.", prazo: "Médio prazo (até 90 dias)" },
        { titulo: "Estabelecer pausas regulares", detalhe: "Programar micropausas e respeitar intervalos previstos em norma.", prazo: "Curto prazo (até 30 dias)" },
      ],
      // A ordem aqui é a ordem de impressão no Plano de Ação, que publica as
      // duas primeiras. Medidas na fonte vêm antes de medidas sobre a pessoa:
      // treinar o trabalhador para suportar a sobrecarga não elimina a
      // sobrecarga, e como ação principal transfere a ele um risco que é da
      // organização do trabalho (NR-01, hierarquia de medidas de controle).
      alto: [
        { titulo: "Redistribuir tarefas", detalhe: "Reorganizar fluxo, prioridades e prazos junto à liderança imediata.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Revisar metas e prazos do GES", detalhe: "Ajustar metas, ritmo e prazos ao efetivo disponível; eliminar acúmulo recorrente de tarefas.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Capacitação em gestão de demandas emocionais", detalhe: "Complementar às medidas organizacionais: treinar trabalhadores expostos a desgaste emocional (atendimento ao público, cuidados, etc.).", prazo: "Médio prazo (até 90 dias)" },
      ],
      critico: [
        { titulo: "Intervenção imediata na carga", detalhe: "Suspender metas/prazos incompatíveis e contratar/realocar mão de obra de forma emergencial.", prazo: "Imediato" },
        { titulo: "Apoio psicossocial", detalhe: "Disponibilizar canal de apoio psicológico (interno ou conveniado) e encaminhamento ao SESMT.", prazo: "Imediato" },
      ],
    },
  },
  {
    dimId: "organizacao",
    acoes: {
      baixo: [{ titulo: "Manter práticas de autonomia", detalhe: "Reforçar boas práticas já existentes em reuniões periódicas.", prazo: "Longo prazo (até 180 dias)" }],
      moderado: [
        { titulo: "Comunicação antecipada", detalhe: "Padronizar entrega de informações e ordens de serviço com antecedência mínima.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Definir prazo mínimo para ordens de serviço", detalhe: "Estabelecer antecedência mínima entre a definição da tarefa e sua execução no GES.", prazo: "Curto prazo (até 30 dias)" },
      ],
      alto: [
        { titulo: "Aumentar autonomia decisória", detalhe: "Definir alçadas e dar voz ao trabalhador sobre o ritmo e o método de trabalho.", prazo: "Médio prazo (até 90 dias)" },
        { titulo: "Revisar previsibilidade de escalas", detalhe: "Publicar escalas com antecedência e regras claras de troca.", prazo: "Curto prazo (até 30 dias)" },
      ],
      critico: [
        { titulo: "Reestruturar organização do trabalho", detalhe: "Diagnóstico ergonômico/organizacional e replanejamento dos processos do GES / Setores.", prazo: "Médio prazo (até 90 dias)" },
        { titulo: "Definir responsabilidades e prioridades", detalhe: "Formalizar o que cabe a cada função e a ordem de prioridade das tarefas do GES.", prazo: "Curto prazo (até 30 dias)" },
      ],
    },
  },
  {
    dimId: "relacoes",
    acoes: {
      baixo: [{ titulo: "Manter clima positivo", detalhe: "Reforçar reuniões de feedback e reconhecimento contínuo.", prazo: "Longo prazo (até 180 dias)" }],
      moderado: [
        { titulo: "Capacitação de lideranças", detalhe: "Treinar chefias em comunicação não violenta, feedback e gestão de pessoas.", prazo: "Médio prazo (até 90 dias)" },
        { titulo: "Clarificar papéis e responsabilidades", detalhe: "Atualizar descrição de cargos e matriz de responsabilidades (RACI).", prazo: "Curto prazo (até 30 dias)" },
      ],
      // A avaliação da liderança vem primeiro: nesta dimensão o perigo é a
      // relação de trabalho e a conduta da chefia. Mentoria entre colegas é
      // rede de apoio para quem já está exposto, não medida sobre a origem.
      alto: [
        { titulo: "Apurar as situações relatadas junto à liderança", detalhe: "Verificar com a chefia imediata do GES as condições de comunicação, apoio e distribuição de tarefas apontadas.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Revisar a distribuição de responsabilidades", detalhe: "Rever o que é decidido pela chefia e o que cabe à equipe, e a cobertura em ausências.", prazo: "Médio prazo (até 90 dias)" },
      ],
      critico: [
        { titulo: "Substituir/realocar liderança quando necessário", detalhe: "Após apuração, considerar mudança da chefia imediata do GES / Setores.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Mediação de conflitos", detalhe: "Acionar mediação interna/externa para reestabelecer relações de trabalho.", prazo: "Imediato" },
      ],
    },
  },
  {
    dimId: "interface",
    acoes: {
      baixo: [{ titulo: "Reforçar políticas de equilíbrio", detalhe: "Divulgar benefícios e práticas de qualidade de vida.", prazo: "Longo prazo (até 180 dias)" }],
      moderado: [
        { titulo: "Política de desconexão", detalhe: "Estabelecer regras claras de comunicação fora do horário de trabalho.", prazo: "Curto prazo (até 30 dias)" },
      ],
      alto: [
        { titulo: "Rever jornadas e horas extras", detalhe: "Auditar banco de horas e horas extras do GES / Setores; eliminar excessos recorrentes.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Flexibilidade quando viável", detalhe: "Avaliar jornadas flexíveis, escalas alternativas ou home office parcial.", prazo: "Médio prazo (até 90 dias)" },
      ],
      critico: [
        { titulo: "Plano de redução de jornada/sobrecarga", detalhe: "Plano formal com metas mensuráveis para reduzir conflito trabalho-vida.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Encaminhamento à SST/RH", detalhe: "Acompanhamento individualizado de casos com sinais de adoecimento.", prazo: "Imediato" },
      ],
    },
  },
  {
    dimId: "saude",
    acoes: {
      baixo: [{ titulo: "Promoção da saúde", detalhe: "Campanhas de sono, atividade física e alimentação.", prazo: "Longo prazo (até 180 dias)" }],
      // Mesma regra da faixa "alto": a primeira ação precisa mirar a condição
      // de trabalho. Rodas de conversa e triagem sozinhas na frente do plano
      // deixam o documento recomendando que o trabalhador lide melhor com um
      // desgaste cuja origem o relatório não tocou.
      moderado: [
        { titulo: "Revisar ritmo, pausas e jornada do GES", detalhe: "Verificar se ritmo, pausas, jornada e acúmulo de tarefas explicam os sinais de desgaste relatados.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Verificar cobertura de ausências e acúmulo", detalhe: "Checar se afastamentos, férias e vagas abertas estão sendo absorvidos pela equipe do GES.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Triagem de saúde mental", detalhe: "Incluir avaliação psicossocial nos exames ocupacionais.", prazo: "Médio prazo (até 90 dias)" },
      ],
      alto: [
        { titulo: "Reavaliar as condições de trabalho do GES", detalhe: "Rever jornada, ritmo, pausas e fatores ambientais (ruído, iluminação, temperatura, ergonomia) que agravam o desgaste.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Analisar a organização do trabalho no GES", detalhe: "Verificar distribuição de tarefas, metas e cobertura de ausências como origem do desgaste relatado.", prazo: "Curto prazo (até 30 dias)" },
      ],
      critico: [
        { titulo: "Acionar SESMT/Medicina do Trabalho", detalhe: "Avaliação clínica imediata e CAT quando aplicável; afastamento se necessário.", prazo: "Imediato" },
        { titulo: "Plano de retorno ao trabalho", detalhe: "Protocolo de reinserção pós-afastamento por causas psicossociais.", prazo: "Curto prazo (até 30 dias)" },
      ],
    },
  },
  {
    dimId: "ofensivos",
    acoes: {
      baixo: [{ titulo: "Reforçar política antiassédio", detalhe: "Divulgação do código de conduta e do canal de denúncias (Lei 14.457/2022, art. 23).", prazo: "Longo prazo (até 180 dias)" }],
      moderado: [
        { titulo: "Capacitação sobre assédio e violência", detalhe: "Exigência legal: Lei 14.457/2022, art. 23, IV — capacitação com periodicidade máxima de 12 meses.", prazo: "Médio prazo (até 90 dias)" },
      ],
      alto: [
        { titulo: "Comitê de ética ativo", detalhe: "Garantir comitê com membros independentes e prazos de apuração.", prazo: "Curto prazo (até 30 dias)" },
        { titulo: "Canal de denúncias com sigilo e anonimato", detalhe: "Exigência legal: Lei 14.457/2022, art. 23, II — canal com garantia de anonimato.", prazo: "Curto prazo (até 30 dias)" },
      ],
      critico: [
        { titulo: "Investigação imediata", detalhe: "Apuração formal dos casos relatados e medidas disciplinares cabíveis.", prazo: "Imediato" },
        { titulo: "Acolhimento das vítimas", detalhe: "Apoio psicológico, jurídico e medidas protetivas (afastamento do agressor).", prazo: "Imediato" },
      ],
    },
  },
];

export type Severidade = "baixo" | "moderado" | "alto" | "critico";

export function severidadeFromScore(score: number): Severidade {
  if (score >= 70) return "critico";
  if (score >= 50) return "alto";
  if (score >= 30) return "moderado";
  return "baixo";
}

export function getRecomendacoes(dimId: string, score: number): Acao[] {
  const r = RECOMENDACOES.find((x) => x.dimId === dimId);
  if (!r) return [];
  return r.acoes[severidadeFromScore(score)];
}
