// Glossário de microtextos do PSICOSAFETY.
// Centraliza mensagens para garantir consistência e nomenclatura (GES, AEP, COPSOQBR).

export const COPY = {
  // Termos oficiais — usar sempre estes nomes na UI.
  termos: {
    ges: "GES (Grupo de Exposição Similar)",
    gesShort: "GES",
    aep: "AEP Premium (Avaliação Ergonômica Preliminar)",
    aepShort: "AEP Premium",
    copsoq: "COPSOQBR",
    inventario: "Inventário de Riscos",
    plano: "Plano de Ação",
    nivelRisco: "Nível de Risco PGR",
    classificacao: "Classificação Psicossocial",
  },

  // Mensagens genéricas
  erros: {
    generico: "Algo deu errado. Tente novamente em instantes.",
    rede: "Não foi possível conectar. Verifique sua internet.",
    permissao: "Você não tem permissão para esta ação.",
    semDados: "Não há dados suficientes para gerar o relatório.",
    funcaoFaltando: "Existe avaliação sem função vinculada.",
    relatorioFalhou: "Não foi possível gerar o relatório porque existem dados pendentes.",
  },

  sucesso: {
    salvo: "Alterações salvas.",
    excluido: "Removido com sucesso.",
    enviado: "Enviado com sucesso.",
    pdfGerado: "PDF gerado com sucesso.",
    download: "Download iniciado.",
  },

  loading: {
    validando: "Validando dados…",
    montando: "Montando relatório…",
    gerando: "Gerando PDF…",
    salvando: "Salvando…",
    carregando: "Carregando…",
  },

  vazio: {
    semEmpresas: "Nenhuma empresa cadastrada ainda.",
    semCampanhas: "Nenhuma campanha encontrada.",
    semRespostas: "Nenhuma resposta recebida.",
    semGes: "Nenhum GES cadastrado.",
    semPendencias: "Tudo certo — nenhuma pendência encontrada.",
  },
} as const;
