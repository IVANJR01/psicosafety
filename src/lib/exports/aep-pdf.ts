// =====================================================================
// AEP — AVALIAÇÃO ERGONÔMICA PRELIMINAR
// FOCO: RISCOS PSICOSSOCIAIS (NR-01 / NR-17)
// Estrutura técnico-legal premium — 13 seções
// Lógica: questionário psicossocial → Agente/Situação → Perigo → Consequência (Guia MTE) →
//          Prob × Sev → Nível → Inventário PGR → Plano de Ação
// =====================================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { getRecomendacoes } from "@/lib/recomendacoes";
import {
  type AepDataset,
  type LinhaFator,
  type NivelRisco,
  type Nivel5,
  nivel5FromValor,
  NIVEL5_COR,
  NIVEL5_FILL,
  NIVEL5_FAIXA,
  mteParaDim,
  caracterizarExposicao,
  assertAgrupamentoGesAplicado,
  amostraSuficiente,
  MIN_RESPONDENTES_CONCLUSAO,
} from "./aep-data";

async function urlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => r.blob());
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// ---- Paleta executiva ----
const PRIMARY: [number, number, number] = [15, 23, 42];   // #0F172A
const ACCENT:  [number, number, number] = [37, 99, 235];  // #2563EB
const SOFT_BG: [number, number, number] = [243, 244, 246];

const NIVEL_COR: Record<NivelRisco, [number, number, number]> = {
  Baixo:   [22, 163, 74],
  Médio:   [202, 138, 4],
  Alto:    [234, 88, 12],
  Crítico: [220, 38, 38],
};
const NIVEL_FILL: Record<NivelRisco, [number, number, number]> = {
  Baixo:   [220, 252, 231],
  Médio:   [254, 249, 195],
  Alto:    [255, 237, 213],
  Crítico: [254, 226, 226],
};

const NIVEL_CONTROLE: Record<NivelRisco, string> = {
  Crítico: "Intolerável — ações imediatas",
  Alto:    "Substancial — controle necessário",
  Médio:   "Moderado — controle adicional",
  Baixo:   "Tolerável — monitoramento",
};

const NIVEL_PRAZO: Record<NivelRisco, string> = {
  Crítico: "Imediato (até 30 dias)",
  Alto:    "Curto prazo (até 90 dias)",
  Médio:   "Médio prazo (até 180 dias)",
  Baixo:   "Monitoramento (até 12 meses)",
};


export type AepPdfOptions = {
  incluirGraficos?: boolean;
  incluirPlanoAcao?: boolean;
  incluirAnexos?: boolean;
  logoEmpresaDataUrl?: string | null;
  /** true (padrão) = mostra somente GES avaliados; false = inclui GES sem avaliação */
  somenteAvaliados?: boolean;
  /** Recebe o nome da etapa atual; usado para diagnóstico de erro na UI */
  onStep?: (step: string) => void;
  /** Quando true, propaga o erro em vez de apenas exibir toast (default false p/ compat) */
  throwOnError?: boolean;
  /** Se presente, marca o PDF como Reavaliação Setorial Complementar */
  contextoReavaliacao?: {
    campanhaOriginal: string;
    motivo: string;
    setoresEscopo: string[];
    respostasValidas: number;
  };
  /** Controles cadastrados por chave "setorId|dominio" (tipo 'existente'). */
  controlesMap?: Map<string, Array<{
    description: string;
    validated: boolean;
    validated_at: string | null;
    status: string;
  }>>;
};

export async function gerarRelatorioAEPpdf(data: AepDataset, opts: AepPdfOptions = {}) {
  const step = (s: string) => {
    try { opts.onStep?.(s); } catch {}
    try { console.log("[AEP-PDF] etapa:", s); } catch {}
  };
  try {
    step("init: validar dataset");
    assertAgrupamentoGesAplicado(data);
    const incluirPlanoAcao = opts.incluirPlanoAcao ?? true;
    const incluirAnexos = opts.incluirAnexos ?? true;
    const somenteAvaliados = opts.somenteAvaliados ?? true;


    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = margin;

    const rgb = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
    const fillRgb = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const ensure = (h: number) => { if (y + h > pageH - 60) { doc.addPage(); y = margin + 30; } };

    let secCount = 0;

    // Espaço útil mínimo para uma seção continuar na página corrente: o título
    // ocupa 46pt, então isto garante o título mais um primeiro bloco de
    // conteúdo e evita título órfão no pé da folha.
    const ESPACO_MINIMO_SECAO = 100;

    const sectionTitle = (titulo: string, opts?: { samePageIfFits?: number }) => {
      step(`seção: ${titulo}`);

      // Uma seção só abre página nova quando não cabe mais nada de útil na
      // atual. Antes toda seção forçava quebra, e o relatório saía com seis
      // das dezesseis páginas carregando menos de 25 linhas — meia folha em
      // branco entre um capítulo e o seguinte. O parâmetro samePageIfFits
      // continua aceito para quem quiser exigir mais espaço que o padrão.
      if (secCount > 0) {
        const minimo = opts?.samePageIfFits ?? ESPACO_MINIMO_SECAO;
        if (y + minimo > pageH - 60) {
          doc.addPage();
          y = margin + 30;
        } else {
          // Respiro entre o fim da seção anterior e o próximo título.
          y += 14;
        }
      }
      secCount += 1;
      const num = String(secCount).padStart(2, "0");
      fillRgb(ACCENT); doc.roundedRect(margin, y, 38, 28, 4, 4, "F");
      rgb([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text(num, margin + 19, y + 19, { align: "center" });
      rgb(PRIMARY); doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(titulo.toUpperCase(), margin + 48, y + 19);
      doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(0.6);
      doc.line(margin, y + 32, pageW - margin, y + 32);
      doc.setLineWidth(0.2);
      rgb([30, 30, 30]); doc.setFont("helvetica", "normal");
      y += 46;
    };

    const subTitle = (txt: string) => {
      ensure(24);
      rgb(PRIMARY); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
      doc.text(txt, margin, y); y += 14;
      rgb([40, 40, 40]); doc.setFont("helvetica", "normal");
    };

    const paragraph = (text: string, size = 10) => {
      ensure(20);
      doc.setFontSize(size); rgb([40, 40, 40]); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(text, pageW - margin * 2);
      lines.forEach((ln: string) => {
        ensure(size + 4);
        doc.text(ln, margin, y);
        y += size + 4;
      });
      y += 4;
    };

    const bullets = (items: string[]) => items.forEach((i) => paragraph("• " + i));

    const callout = (text: string, color: [number, number, number] = ACCENT) => {
      ensure(40);
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(text, pageW - margin * 2 - 20);
      const h = 14 + lines.length * 13;
      fillRgb(color);
      doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
      doc.rect(margin, y, pageW - margin * 2, h, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(2.5);
      doc.line(margin, y, margin, y + h);
      doc.setLineWidth(0.2);
      rgb([40, 40, 40]); doc.setFont("helvetica", "normal");
      doc.text(lines, margin + 12, y + 16);
      y += h + 10;
    };

    // ============== 01. IDENTIFICAÇÃO ==============
    // A capa de página inteira saiu. Era uma peça comercial: slogans ("Do
    // diagnóstico à ação preventiva", "Cuidar das pessoas é fortalecer o
    // futuro da empresa"), quatro blocos de benefícios do sistema e um QR
    // code sob "Documento auditável — Valide a autenticidade deste
    // relatório". O QR era estático, o MESMO em todos os relatórios: anunciava
    // uma validação por documento que não existe, e num relatório técnico isso
    // é uma declaração que não se sustenta perante quem for conferir.
    //
    // No lugar, um cabeçalho de identificação com o que a AEP precisa nomear —
    // o que é o documento e sob quais normas — e o corpo começa na mesma
    // página. O documento perde uma folha inteira e nenhuma informação.
    y = margin + 24;
    fillRgb(PRIMARY); doc.roundedRect(margin, y, pageW - margin * 2, 74, 8, 8, "F");
    rgb([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("RELATÓRIO TÉCNICO", margin + 16, y + 24);
    doc.setFontSize(14);
    doc.text("AVALIAÇÃO ERGONÔMICA PRELIMINAR — RISCOS PSICOSSOCIAIS", margin + 16, y + 44);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); rgb([191, 219, 254]);
    doc.text("NR-01  |  NR-17", margin + 16, y + 62);
    y += 90;

    sectionTitle("Identificação");
    const e = data.empresa;
    const dataAval = data.periodo.inicio || data.periodo.fim
      ? `${data.periodo.inicio ?? "-"} a ${data.periodo.fim ?? "-"}`
      : data.emitidoEm.slice(0, 10);

    // Nenhuma lista nominal de GES sai aqui. Antes saíam três — cadastrados,
    // avaliados e "consolidado" — com os mesmos nomes repetidos, e a seção de
    // caracterização dos GES, logo adiante, os listava pela quarta vez, aí sim
    // com funções e respondentes. Aqui ficam os totais; os nomes ficam onde há
    // o que dizer sobre eles. A exceção é a lista dos GES sem avaliação, que
    // não aparece em nenhuma outra seção quando o inventário é só de avaliados.
    const gesSemStr = data.gesSemAvaliacao.length
      ? data.gesSemAvaliacao.map((g) => `• ${g.label}`).join("\n")
      : "Nenhum — todos os GES cadastrados foram avaliados";

    const rt = data.responsavelTec;
    const respNome = (rt?.nome || data.responsavelTecnico || "").trim() || "—";
    const respForm = (rt?.formacao || (e as any)?.resp_formacao || "").trim() || "—";
    const respReg  = (rt?.registro || (e as any)?.resp_registro || "").trim() || "—";
    const fixTypos = (s: string) => s
      .replace(/Segurnça/gi, "Segurança")
      .replace(/Seguranca/g, "Segurança");
    const respCargo = fixTypos((rt?.cargo || (e as any)?.responsavel_cargo || "").trim()) || "—";

    const totCad = data.gesCadastrados.length;
    const totAva = data.gesAvaliados.length;
    const totSem = data.gesSemAvaliacao.length;
    const tt = data.totaisTrabalhadores ?? {};
    const trabCad = tt.cadastrados ?? (e as any)?.num_trabalhadores ?? "—";
    const trabAbr = tt.abrangidos ?? data.totalRespostas;

    // Linha só entra se houver valor. Antes CNAE, Endereço e Grau de Risco
    // saíam sempre — em branco quando a empresa não os cadastrou —, e o
    // documento gastava três linhas para não dizer nada. Nome Fantasia só
    // aparece quando difere da Razão Social: repetir o mesmo nome duas vezes
    // seguidas é ruído, não identificação.
    const norm = (v: unknown) => String(v ?? "").trim();
    const razaoSocial = norm((e as any)?.razao_social) || norm(e?.nome) || norm(data.empresaNome);
    const nomeFantasia = norm(e?.nome);
    const linhasEmpresa: any[] = [["Razão Social", razaoSocial || "—"]];
    const addSeTiver = (rotulo: string, valor: unknown) => {
      const v = norm(valor);
      if (v) linhasEmpresa.push([rotulo, v]);
    };
    if (nomeFantasia && nomeFantasia.toLowerCase() !== razaoSocial.toLowerCase()) {
      linhasEmpresa.push(["Nome Fantasia", nomeFantasia]);
    }
    addSeTiver("CNPJ", e?.cnpj);
    addSeTiver("CNAE", (e as any)?.cnae);
    addSeTiver("Endereço", (e as any)?.endereco);
    addSeTiver("Grau de Risco", (e as any)?.grau_risco);
    // Trabalhadores cadastrados: só mostra se houver valor real
    if (trabCad !== "—" && trabCad != null && String(trabCad).trim() !== "") {
      linhasEmpresa.push(["Trabalhadores cadastrados na empresa", String(trabCad)]);
    }
    linhasEmpresa.push(["Trabalhadores participantes / respondentes válidos", String(data.totalRespostas)]);
    if (!somenteAvaliados) {
      linhasEmpresa.push(["Trabalhadores abrangidos pelos GES avaliados", String(trabAbr)]);
      linhasEmpresa.push(["GES cadastrados no sistema", String(totCad)]);
    }
    linhasEmpresa.push(["GES avaliados neste relatório", String(totAva)]);
    if (!somenteAvaliados && totSem > 0) {
      linhasEmpresa.push([`GES sem avaliação neste ciclo (${totSem})`, gesSemStr]);
    }
    linhasEmpresa.push(["Data da Avaliação", dataAval]);
    // Responsável Técnico sempre sai, mesmo em branco: é campo obrigatório do
    // documento e a lacuna precisa ficar visível. Formação, registro e cargo
    // seguem a regra geral — só aparecem quando preenchidos.
    linhasEmpresa.push(["Responsável Técnico", respNome]);
    [["Formação", respForm], ["Registro Profissional", respReg], ["Cargo", respCargo]]
      .forEach(([rotulo, valor]) => addSeTiver(rotulo, valor === "—" ? "" : valor));

    autoTable(doc, {
      startY: y,
      body: linhasEmpresa,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 6, valign: "top" },
      columnStyles: {
        0: { cellWidth: 200, fontStyle: "bold", textColor: PRIMARY, fillColor: SOFT_BG },
        1: { textColor: [40, 40, 40] },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 20;

    /*
     * `secoesEmitidas` não é mais impresso como sumário — num relatório com as
     * seções numeradas e tituladas no corpo, a página de sumário só gastava
     * espaço. A lista continua existindo porque é dela que sai a referência
     * cruzada à seção do Plano de Ação, que precisa acompanhar as seções
     * condicionais (Plano de Ação e Anexo).
     *
     * Esta lista precisa espelhar EXATAMENTE as seções emitidas, na ordem: é
     * dela que sai o número citado no corpo do texto. Divergir aqui manda o
     * leitor para uma seção que não existe.
     */
    const secoesEmitidas: string[] = [
      "Dados da Empresa",
      "Objetivo",
      "Metodologia Aplicada",
      "Caracterização dos GES / Setores / Funções Avaliadas",
      "Resultado da Avaliação do Questionário Psicossocial",
      "Distribuição dos Resultados por Domínio / GES",
      "Classificação e Avaliação dos Riscos Psicossociais",
      "Inventário Preliminar de Riscos Psicossociais",
      ...(incluirPlanoAcao ? ["Plano de Ação Recomendado"] : []),
      "Conclusão Técnica",
    ];
    // ============== 02. OBJETIVO ==============
    sectionTitle("Objetivo");
    paragraph(
      "A presente AEP tem por objetivo identificar e avaliar preliminarmente fatores de riscos " +
      "psicossociais relacionados às condições de trabalho, subsidiando o gerenciamento dos riscos " +
      "ocupacionais e a integração das informações ao PGR, quando aplicável."
    );
    paragraph(
      "Os resultados representam a percepção coletiva dos trabalhadores no período da avaliação e " +
      "devem ser considerados em conjunto com a análise das condições reais de trabalho. Não " +
      "constituem diagnóstico clínico individual."
    );

    // ============== 04. METODOLOGIA ==============
    // Mantém na mesma página da Introdução se houver espaço (~200pt necessários)
    sectionTitle("Metodologia Aplicada", { samePageIfFits: 200 });

    if (opts.contextoReavaliacao) {
      const ctx = opts.contextoReavaliacao;
      subTitle("Tipo de avaliação: Reavaliação Setorial Complementar");
      paragraph(
        "A presente avaliação representa uma reavaliação setorial complementar, realizada apenas " +
        "nos setores/GES selecionados, com o objetivo de confirmar ou revisar os achados " +
        "psicossociais identificados na avaliação anterior. Os resultados não representam a " +
        "totalidade da empresa, mas sim o recorte específico da nova coleta."
      );
      paragraph(`Campanha original: ${ctx.campanhaOriginal}`);
      if (ctx.motivo) paragraph(`Motivo da reavaliação: ${ctx.motivo}`);
      if (ctx.setoresEscopo.length > 0) {
        paragraph(`Setores/GES reavaliados: ${ctx.setoresEscopo.join("; ")}`);
      }
      paragraph(`Respostas válidas da reavaliação: ${ctx.respostasValidas}`);
      callout(
        "Diferenças entre a avaliação original e a reavaliação podem ocorrer em razão do recorte " +
        "de respondentes, do período da coleta, de mudanças organizacionais, da adesão dos " +
        "trabalhadores e da percepção coletiva no momento da aplicação.",
        ACCENT,
      );
    }

    // Três subtítulos numerados viraram três frases. O que saiu era o método se
    // justificando dentro do relatório entregue à empresa: que o MTE não define
    // metodologia para questionários, que o piso de respondentes preserva o
    // anonimato, que não é exigência normativa. É documentação da plataforma,
    // não achado da avaliação, e cada explicação a mais é uma frase a mais para
    // defender numa fiscalização.
    //
    // As faixas ficam: a NR-01 (subitem 1.5.4.4.2) pede que a organização
    // declare os critérios que usa para classificar, e a tabela de resultados
    // imprime BAIXO/MÉDIO/ALTO. Sem a linha, o documento classifica sem dizer
    // por qual régua.
    paragraph(
      "Foi aplicado questionário estruturado para identificação de fatores psicossociais " +
      "relacionados ao trabalho, com participação anônima. Os resultados foram consolidados por " +
      "domínio e por GES, servindo como subsídio à avaliação das condições de trabalho e ao " +
      "gerenciamento dos riscos ocupacionais."
    );
    paragraph(
      "Critério de interpretação adotado: 0–33% = BAIXO · 34–66% = MÉDIO · 67–100% = ALTO. " +
      `Recortes com menos de ${MIN_RESPONDENTES_CONCLUSAO} respondentes não foram classificados ` +
      "quantitativamente e permanecem sujeitos à avaliação complementar das condições de trabalho."
    );

    paragraph(
      "Cada domínio é relacionado a um agente/situação, a um perigo e a possíveis agravos à saúde, " +
      "com nomenclatura do Guia de Fatores de Riscos Psicossociais do MTE, e classificado pela " +
      "matriz Probabilidade × Severidade para compor o Inventário e o Plano de Ação."
    );


    // ============== 05. GES / SETORES / FUNÇÕES ==============
    sectionTitle("Caracterização dos GES / Setores / Funções Avaliadas");
    paragraph(
      "Identificação dos Grupos de Exposição Similar (GES) avaliados, suas funções, respondentes " +
      "válidos e a representatividade na amostra."
    );

    if (data.setores.length === 0) {
      paragraph("Nenhum GES / Setores identificado no recorte selecionado.");
    } else {
      const totalConv = data.totalConvidados ?? data.totalRespostas;
      const cleanFuncNome = (nome: string) => nome.replace(/[,;\s]+$/g, "").trim();
      const dedupFuncoes = (fs: typeof data.setores[number]["funcoes"]) => {
        const map = new Map<string, number>();
        fs.forEach((f) => {
          const k = cleanFuncNome(f.funcao);
          if (!k) return;
          map.set(k, (map.get(k) ?? 0) + f.n);
        });
        return Array.from(map, ([funcao, n]) => ({ funcao, n }));
      };
      const gheBody = data.setores.map((s) => {
        const part = totalConv > 0 ? Math.round((s.n / totalConv) * 100) : 100;
        const funcoesDedup = dedupFuncoes(s.funcoes);
        return [
          formatLabelGes(s.label),
          funcoesDedup.map((f) => `${f.funcao} (${f.n})`).join("\n") || "—",
          String(s.n),
          `${part}%`,
        ];
      });
      autoTable(doc, {
        startY: y,
        // "Nº Trab." saiu: a coluna imprimia o MESMO valor de "Resp. válidas"
        // (a plataforma não cadastra efetivo por GES), e um leitor que compara
        // as duas conclui participação de 100% onde só existe o número de quem
        // respondeu. Sobra o dado que o sistema de fato possui.
        head: [["GES / Setores", "Funções avaliadas", "Respondentes\nválidos", "% da\namostra"]],
        body: gheBody,
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center", valign: "middle", cellPadding: 4 },
        styles: { fontSize: 8, cellPadding: 3.5, valign: "middle", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 150, halign: "left" },
          1: { cellWidth: "auto" },
          2: { halign: "center", cellWidth: 76 },
          3: { halign: "center", cellWidth: 55 },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 14;

      paragraph(
        "Observação: \"Respondentes válidos\" são os trabalhadores que participaram da avaliação no " +
        "GES, não o efetivo do grupo. O percentual da amostra refere-se ao total de participantes " +
        "da avaliação.",
        9,
      );

    }


    // (Removido: tabela "Setores cadastrados sem avaliação dentro dos GES avaliados".
    //  O relatório é por GES — se o GES teve resposta em qualquer setor vinculado,
    //  o GES inteiro é considerado avaliado e exibido com todos os seus setores.)


    // ---- GES cadastrados sem avaliação neste ciclo ----
    if (!somenteAvaliados && data.gesSemAvaliacao.length > 0) {
      subTitle("GES cadastrados sem avaliação neste ciclo");
      paragraph(
        `Os GES abaixo estão cadastrados no sistema, porém não receberam respostas válidas ` +
        `nesta avaliação. Permanecem listados para fins de rastreabilidade do PGR, mas NÃO ` +
        `compõem o cálculo de risco psicossocial deste ciclo.`,
        9,
      );
      autoTable(doc, {
        startY: y,
        head: [["GES", "Setores vinculados", "Status", "Justificativa", "Ação recomendada"]],
        body: data.gesSemAvaliacao.map((g) => [
          g.gesFormatado,
          g.setores.map((s) => s.setor).join(" / "),
          "Não avaliado neste ciclo",
          g.justificativa || "Sem respostas válidas no ciclo atual",
          "Aplicar avaliação ou justificar formalmente no PGR.",
        ]),
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center" },
        styles: { fontSize: 8, cellPadding: 4, valign: "top", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: "bold" },
          1: { cellWidth: 130 },
          2: { cellWidth: 70, halign: "center", fontStyle: "bold", textColor: [180, 83, 9] },
          3: { cellWidth: 115 },
          4: {},
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }


    // ============== 06. RESULTADO DA AVALIAÇÃO PSICOSSOCIAL ==============
    sectionTitle("Resultado da Avaliação do Questionário Psicossocial");
    paragraph(
      "Os percentuais representam os resultados obtidos no questionário e devem ser analisados em " +
      "conjunto com as condições reais de trabalho."
    );

    const fatoresValidos = data.fatoresGerais.filter((f) => f.n > 0);

    // A coluna "Leitura técnica preventiva" repetia, em texto fixo por domínio,
    // o que o próprio nome do domínio já diz ("Fatores ofensivos → atenção para
    // assédio"). Ocupava metade da largura da página sem acrescentar achado.
    let resultInsuficientes = 0;
    const resultadoBody = fatoresValidos.length
      ? fatoresValidos.map((f) => {
          let classif = f.classifPsico.toUpperCase();
          if (f.scorePct >= 34 && f.scorePct <= 66 && classif === "BAIXO") {
            classif = "MÉDIO";
            // eslint-disable-next-line no-console
            console.warn(`[AEP] Inconsistência de classificação em "${f.dim.title}" (${f.scorePct}%): percentual médio não pode ser classificado como baixo. Corrigido para MÉDIO.`);
          }
          // Amostra pequena: não imprime percentual nem classificação. Um "0%"
          // com três respondentes é lido como ausência de risco quando na
          // verdade é ausência de dado — e num domínio como assédio essa
          // diferença decide se o documento protege ou incrimina a empresa.
          if (!amostraSuficiente(f.n)) {
            resultInsuficientes += 1;
            return [f.dim.title, String(f.n), "—", "NÃO\nCLASSIFICADO"];
          }
          return [f.dim.title, String(f.n), `${f.scorePct}%`, classif];
        })
      : [["—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Domínio avaliado", "n", "%", "Classif.\nPsicoss."]],
      body: resultadoBody,
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9, halign: "center", valign: "middle" },
      styles: { fontSize: 9, cellPadding: 4, valign: "middle" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: "auto" },
        1: { halign: "center", cellWidth: 34 },
        2: { halign: "center", cellWidth: 46, fontStyle: "bold" },
        3: { halign: "center", cellWidth: 68, fontStyle: "bold", fontSize: 8 },
      },
      didParseCell: (h) => {
        // Índice 3: a coluna "n" empurrou a classificação uma posição à direita.
        if (h.section === "body" && h.column.index === 3) {
          const raw = String(h.cell.raw ?? "");
          const map: Record<string, NivelRisco> = { BAIXO: "Baixo", MÉDIO: "Médio", ALTO: "Alto", CRÍTICO: "Crítico" };
          const lvl = map[raw];
          if (lvl) { h.cell.styles.fillColor = NIVEL_FILL[lvl]; h.cell.styles.textColor = NIVEL_COR[lvl]; }
          else if (raw.startsWith("NÃO CLASSIFICADO") || raw.startsWith("NÃO\nCLASSIFICADO")) {
            // Cinza neutro: não é um nível de risco, e não pode parecer um.
            h.cell.styles.fillColor = [243, 244, 246];
            h.cell.styles.textColor = [75, 85, 99];
            h.cell.styles.fontSize = 7;
          }
        }
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 14;

    // A explicação que morava na coluna removida, agora uma vez só sob a tabela
    // em vez de repetida linha a linha.
    if (resultInsuficientes > 0) {
      const um = resultInsuficientes === 1;
      paragraph(
        `${resultInsuficientes} ${um ? "domínio não foi classificado" : "domínios não foram classificados"} ` +
        "quantitativamente por participação insuficiente.",
        9,
      );
    }

    // ============== 07. DISTRIBUIÇÃO POR GES ==============
    sectionTitle("Distribuição dos Resultados por Domínio / GES");
    // Dois parágrafos viraram um: o segundo explicava, em quatro linhas, que um
    // GES pode superar a média da empresa — o que a própria tabela mostra.
    paragraph("Domínio com maior resultado no questionário em cada GES.");

    if (data.setores.length === 0) {
      paragraph("Sem dados por setor no recorte.");
    } else {
      // O recorte por GES divide a amostra: um GES de dois respondentes recebia
      // percentual e classificação com o mesmo peso visual de um GES de
      // cinquenta. Aqui a regra é a mesma da seção anterior — a linha continua
      // visível (o GES foi avaliado e some-lo esconderia cobertura), mas a
      // conclusão só é impressa quando a amostra a sustenta.
      const distBody: any[] = [];
      let distInsuficientes = 0;
      data.setores.forEach((s) => {
        const fp = s.fatorPrincipal;
        if (!fp || fp.n === 0) return;
        const suficiente = amostraSuficiente(fp.n);
        if (!suficiente) distInsuficientes += 1;
        distBody.push([
          formatLabelGes(s.label),
          fp.dim.title,
          String(fp.n),
          suficiente ? `${fp.scorePct}%` : "—",
          suficiente ? fp.classifPsico.toUpperCase() : "NÃO\nCLASSIFICADO",
        ]);
      });

      autoTable(doc, {
        startY: y,
        // "Domínio crítico" soava como classificação de risco. O que a coluna
        // traz é o domínio de maior percentual no questionário daquele GES —
        // um resultado de instrumento, não um nível de risco de PGR.
        head: [["GES / Setores", "Domínio com maior\nresultado no questionário", "n", "%", "Classif.\nPsicoss."]],
        body: distBody.length ? distBody : [["—", "—", "—", "—", "—"]],
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9, halign: "center" },
        styles: { fontSize: 9, cellPadding: 4, valign: "middle", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 175 },
          1: { cellWidth: 150 },
          2: { halign: "center", cellWidth: 26 },
          3: { halign: "center", cellWidth: 40, fontStyle: "bold" },
          4: { halign: "center", cellWidth: 68, fontStyle: "bold", fontSize: 8 },
        },
        // Sem isto o rótulo do GES quebrava no meio: "GES 09" no pé de uma
        // página e "COMERCIAL" no topo da seguinte, como se fossem dois GES.
        rowPageBreak: "avoid",
        didParseCell: (h) => {
          if (h.section === "body" && h.column.index === 4) {
            const raw = String(h.cell.raw ?? "").toUpperCase();
            const map: Record<string, NivelRisco> = { BAIXO: "Baixo", MÉDIO: "Médio", ALTO: "Alto", CRÍTICO: "Crítico" };
            const lvl = map[raw];
            if (lvl) { h.cell.styles.fillColor = NIVEL_FILL[lvl]; h.cell.styles.textColor = NIVEL_COR[lvl]; }
            else if (raw.startsWith("NÃO CLASSIFICADO") || raw.startsWith("NÃO\nCLASSIFICADO")) {
              h.cell.styles.fillColor = [243, 244, 246];
              h.cell.styles.textColor = [75, 85, 99];
              h.cell.styles.fontSize = 7;
            }
          }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 18;

      if (distInsuficientes > 0) {
        const um = distInsuficientes === 1;
        paragraph(
          "GES com participação insuficiente não foram classificados quantitativamente.",
          9,
        );
      }
    }

    // ============== 09. CLASSIFICAÇÃO E AVALIAÇÃO DOS RISCOS PSICOSSOCIAIS ==============
    // Exige mais que o padrão: título (46) + parágrafo de abertura (~50) + a
    // matriz 5x5, que pede 260 e tem ensure() próprio. Com o mínimo padrão o
    // título ficava no pé de uma página e a matriz caía na seguinte.
    sectionTitle("Critérios de Classificação do Risco", { samePageIfFits: 190 });
    paragraph(
      "O nível de risco do Inventário resulta do produto Probabilidade × Severidade, pelas escalas " +
      "e faixas abaixo."
    );

    // O DESENHO da matriz 5x5 saiu. O que a NR-01 (subitem 1.5.4.4.2) pede é
    // que a organização declare o critério de classificação, e o critério está
    // inteiro nas duas tabelas abaixo: as escalas de P e S e as faixas de P x S
    // com a ação correspondente. Com elas, qualquer leitor refaz a conta e
    // chega ao mesmo nível. O grid colorido ilustrava o mesmo critério numa
    // segunda forma, e custava metade de uma página.

    // ---- Escalas e níveis, lado a lado ----
    // Os rótulos são os mesmos do eixo da matriz acima (probLabels). Antes esta
    // tabela descrevia CONDIÇÃO ("Ambiente saudável", "Problema frequente")
    // enquanto o eixo da matriz descrevia CHANCE ("Rara", "Muito provável") —
    // duas escalas diferentes para o mesmo número, na mesma página. A NR-1
    // (subitem 1.5.4.4.2) define o nível de risco como combinação de severidade
    // com a PROBABILIDADE de ocorrência, então é a chance que precisa ser
    // nomeada aqui.
    const escY = y;
    const escLargura = (pageW - margin * 2 - 16) / 2;
    const escDireitaX = margin + escLargura + 16;

    autoTable(doc, {
      startY: escY,
      head: [["#", "Probabilidade\n(chance)", "Severidade\n(impacto potencial)"]],
      body: [
        ["1", "Rara", "desconforto leve"],
        ["2", "Pouco provável", "fadiga mental leve"],
        ["3", "Possível", "estresse ocupacional"],
        // "transtornos psicológicos" e "adoecimento grave" nomeavam quadros
        // clínicos numa escala que gradua severidade potencial, não diagnóstico.
        ["4", "Provável", "agravo relevante à saúde"],
        ["5", "Muito provável", "agravo grave à saúde"],
      ],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 7.5, halign: "center", valign: "middle", cellPadding: 2.5 },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: { 0: { halign: "center", fontStyle: "bold", cellWidth: 16 } },
      tableWidth: escLargura,
      margin: { left: margin, right: margin },
    });
    const fimEsq = (doc as any).lastAutoTable.finalY;

    const niveis5: Nivel5[] = ["TRIVIAL", "TOLERÁVEL", "MODERADO", "SUBSTANCIAL", "INTOLERÁVEL"];
    autoTable(doc, {
      startY: escY,
      head: [["Nível de risco\n(P × S)", "Faixa", "Ação de controle"]],
      body: [
        // "nenhuma ação" dispensava o acompanhamento que a NR-01 exige mesmo
        // no risco mais baixo, e num relatório preliminar seria lido como
        // dispensa definitiva.
        ["TRIVIAL", NIVEL5_FAIXA.TRIVIAL, "manter controles e acompanhar"],
        ["TOLERÁVEL", NIVEL5_FAIXA.TOLERÁVEL, "monitoramento"],
        ["MODERADO", NIVEL5_FAIXA.MODERADO, "controle adicional"],
        ["SUBSTANCIAL", NIVEL5_FAIXA.SUBSTANCIAL, "controle necessário"],
        ["INTOLERÁVEL", NIVEL5_FAIXA.INTOLERÁVEL, "ações imediatas"],
      ],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 7.5, halign: "center", valign: "middle", cellPadding: 2.5 },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: "bold", halign: "center", cellWidth: 74 },
        1: { halign: "center", cellWidth: 38 },
      },
      didParseCell: (h) => {
        if (h.section === "body" && h.column.index === 0) {
          const lvl = niveis5[h.row.index];
          h.cell.styles.fillColor = NIVEL5_FILL[lvl];
          h.cell.styles.textColor = NIVEL5_COR[lvl];
        }
      },
      tableWidth: escLargura,
      margin: { left: escDireitaX, right: margin },
    });
    y = Math.max(fimEsq, (doc as any).lastAutoTable.finalY) + 16;

    // ============== 10. INVENTÁRIO DE RISCOS OCUPACIONAIS PARA O PGR ==============
    // Renderizado em página própria em PAISAGEM — título, intro e tabela
    // ficam SEMPRE na mesma página. Não emitimos título na página retrato
    // anterior para evitar página quase-vazia (apenas título).

    const invBody: any[] = [];
    // Quantas linhas caíram no estado "sem evidência de controle". A frase
    // longa é a mesma para todas e inchava a coluna; vira o rótulo curto
    // CONTROLE_A_VALIDAR na célula, com a explicação numa nota única sob a
    // tabela. Linhas que TÊM controle registrado seguem mostrando o texto real.
    //
    // O rótulo não pode ser "—": num inventário de PGR o traço é lido como
    // campo vazio ou como ausência de controle, e nenhuma das duas é o caso.
    // O que existe é ausência de EVIDÊNCIA no momento da avaliação, e o que a
    // linha exige é validação em campo — que é o que a célula passa a dizer.
    let linhasSemControle = 0;
    // Linhas cujo GES ficou abaixo do piso de respondentes: a classificação
    // existe, mas não se sustenta apenas no questionário.
    let linhasBaseFraca = 0;
    // Quebra explícita antes de "validar em campo" para nunca cortar a palavra.
    const CONTROLE_PADRAO = "Controle não evidenciado no momento da avaliação —\nvalidar em campo.";
    const CONTROLE_A_VALIDAR = "A validar\nem campo";
    // A coluna "Função" saiu do Inventário: as funções de cada GES já saem na
    // seção de caracterização, com o número de respondentes por função, e aqui
    // custavam duas linhas em TODA linha da tabela — era o que empurrava o
    // inventário para uma segunda página paisagem. O risco é inventariado por
    // GES, que é a unidade de exposição similar.

    // Índice setor.nome (normalizado) → setor.id, para casar com controles cadastrados.
    const setorNomeParaId = new Map<string, string>();
    (data.empresa?.setoresFull ?? []).forEach((s) => {
      setorNomeParaId.set(String(s.nome ?? "").trim().toLowerCase(), s.id);
    });
    const STATUS_VALIDADO_SET = new Set(["implementado", "eficaz", "em_acompanhamento", "concluido"]);
    // Contadores para o log final de auditoria
    let controlesAplicadosCount = 0;
    let controlesLookupCount = 0;
    const textoControleParaLinha = (setorNome: string, dominio: string): string => {
      controlesLookupCount++;
      if (!opts.controlesMap || opts.controlesMap.size === 0) {
        return CONTROLE_PADRAO;
      }
      const nomeNorm = setorNome.trim().toLowerCase();
      const dominioNorm = dominio.trim().toLowerCase();
      const setorId = setorNomeParaId.get(nomeNorm) ?? "";
      // Aliases do domínio: id COPSOQ e título (aep-pdf desconhece DIMENSIONS aqui;
      // tentamos o valor bruto + variações comuns de título).
      const aliases = new Set<string>([dominioNorm]);
      // Fallback: se `dominio` vier como id ("demandas"), o mapa já foi indexado
      // sob id e título em carregarControlesExistentes — basta procurar por id.
      const chavesTentativas: string[] = [];
      aliases.forEach((a) => {
        if (setorId) chavesTentativas.push(`${setorId.toLowerCase()}|${a}`);
        chavesTentativas.push(`nome:${nomeNorm}|${a}`);
        chavesTentativas.push(`nome:|${a}`);
      });
      let controles: any[] | undefined;
      for (const k of chavesTentativas) {
        const hit = opts.controlesMap.get(k);
        if (hit && hit.length > 0) { controles = hit; break; }
      }
      if (!controles || controles.length === 0) return CONTROLE_PADRAO;
      controlesAplicadosCount++;
      let algumValidado = false;
      let algumPendente = false;
      let dataValidacao: string | null = null;
      const descs: string[] = [];
      controles.forEach((c) => {
        descs.push(c.description.trim());
        if (c.validated || STATUS_VALIDADO_SET.has(c.status)) {
          algumValidado = true;
          if (!dataValidacao && c.validated_at) dataValidacao = c.validated_at;
        } else {
          algumPendente = true;
        }
      });
      const body = descs.join("; ");
      if (algumValidado && !algumPendente) {
        const dt = dataValidacao ? ` — validado em campo em ${new Date(dataValidacao).toLocaleDateString("pt-BR")}` : " — validado em campo";
        return `${body}${dt}.`;
      }
      if (algumValidado && algumPendente) {
        return `${body} — controles parcialmente validados em campo; itens pendentes de verificação.`;
      }
      return `${body} — controle informado pela empresa; pendente de validação em campo.`;
    };

    // Linhas por GES/Função (preferencial)
    if (data.setores.length > 0) {
      data.setores.forEach((s) => {
        const fp = s.fatorPrincipal;
        if (!fp || fp.n === 0) return;
        const mte = mteParaDim(fp.dim.id, fp.risco.nivel);
        const controleTxt = textoControleParaLinha(s.setor, fp.dim.id);
        const semControle = controleTxt === CONTROLE_PADRAO;
        if (semControle) linhasSemControle += 1;
        // O perigo permanece no inventário — suprimi-lo seria subnotificar
        // risco. Mas a origem da classificação precisa ficar visível: abaixo do
        // piso interno, o P x S desta linha vem de um resultado que a própria
        // seção de resultados marcou como insuficiente para concluir. Sem esta
        // marca o documento se contradiz — diz "não é possível afirmar" numa
        // página e publica "MODERADO" na outra, para o mesmo GES.
        const baseFraca = !amostraSuficiente(fp.n);
        if (baseFraca) linhasBaseFraca += 1;
        // Abaixo do piso amostral, P, S e nível saem em branco. A versão
        // anterior publicava a classificação com um asterisco de ressalva, e a
        // ressalva não segurava: o número, uma vez impresso, é o que vai para o
        // PGR. O perigo continua inventariado — some a conclusão, não a linha —
        // e o Plano de Ação recebe a ação de avaliação complementar.
        const car = caracterizarExposicao(fp);
        invBody.push([
          formatLabelGes(s.label) + (baseFraca ? " *" : ""),
          protectWords(fp.dim.title),
          protectWords(mte.agente),
          protectWords(mte.perigo),
          protectWords(mte.consequencia),
          semControle ? CONTROLE_A_VALIDAR : protectWords(controleTxt),
          baseFraca ? "—" : car.duracao,
          baseFraca ? "—" : car.frequencia,
          baseFraca ? "—" : car.intensidade,
          baseFraca ? "—" : String(fp.prob),
          baseFraca ? "—" : String(fp.sev),
          baseFraca ? "A avaliar" : fp.risco.nivel5,
        ]);
      });
    }

    // Linhas consolidadas — APENAS quando não há dados por GES / Setores no recorte.
    if (data.setores.length === 0) {
      fatoresValidos.forEach((f) => {
        const mte = mteParaDim(f.dim.id, f.risco.nivel);
        linhasSemControle += 1;
        const baseFraca = !amostraSuficiente(f.n);
        if (baseFraca) linhasBaseFraca += 1;
        const car = caracterizarExposicao(f);
        invBody.push([
          protectWords(data.empresaNome) + (baseFraca ? " *" : ""),
          protectWords(f.dim.title),
          protectWords(mte.agente),
          protectWords(mte.perigo),
          protectWords(mte.consequencia),
          CONTROLE_A_VALIDAR,
          baseFraca ? "—" : car.duracao,
          baseFraca ? "—" : car.frequencia,
          baseFraca ? "—" : car.intensidade,
          baseFraca ? "—" : String(f.prob),
          baseFraca ? "—" : String(f.sev),
          baseFraca ? "A avaliar" : f.risco.nivel5,
        ]);
      });
    }

    // ---- Página dedicada em PAISAGEM (título + intro + tabela juntos) ----
    doc.addPage("a4", "landscape");
    const lwPageW = doc.internal.pageSize.getWidth();
    // Incrementa o contador de seções para que o número exibido no corpo
    // (e nas seções subsequentes) bata com o sumário.
    secCount += 1;
    const invNum = String(secCount).padStart(2, "0");
    fillRgb(ACCENT); doc.roundedRect(margin, 36, 38, 28, 4, 4, "F");
    rgb([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(invNum, margin + 19, 55, { align: "center" });
    rgb(PRIMARY); doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("INVENTÁRIO PRELIMINAR DE RISCOS PSICOSSOCIAIS PARA VALIDAÇÃO E INTEGRAÇÃO AO PGR", margin + 48, 55);
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(0.6);
    doc.line(margin, 68, lwPageW - margin, 68);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const introLines = doc.splitTextToSize(
      "Resultado preliminar da AEP, para validação pela organização e integração ao Inventário de Riscos do PGR. Cada linha é hipótese técnica levantada por questionário, não risco confirmado: a confirmação depende da avaliação das condições de trabalho. Duração, frequência e intensidade são caracterização preliminar da exposição, a confirmar em campo pelo responsável técnico (NR-17, subitem 17.3.1.1).",
      lwPageW - margin * 2,
    );
    doc.text(introLines, margin, 84);
    const invStartY = 84 + introLines.length * 11 + 8;

    autoTable(doc, {
      startY: invStartY,
      // "Possível Consequência" virou "Possíveis agravos à saúde relacionados
      // ao trabalho": é a expressão do Guia MTE e não deixa margem para ler a
      // coluna como previsão de dano num trabalhador específico.
      // Duração/Frequência/Intensidade migraram da seção "Caracterização da
      // Exposição", que era uma página retrato inteira repetindo GES e domínio
      // para dizer três palavras derivadas do mesmo P e S já impressos aqui.
      head: [["GES / Setores", "Domínio", "Agente / Situação", "Perigo", "Possíveis agravos à saúde relacionados ao trabalho", "Controles", "Duração", "Frequência", "Intensidade", "P", "S", "Nível de\nrisco PGR"]],
      body: invBody.length ? invBody : [["—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 6.8, halign: "center", valign: "middle", cellPadding: 2 },
      styles: { fontSize: 6.8, cellPadding: 2, valign: "top", overflow: "linebreak" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // Soma = 762pt — exatamente a A4 paisagem (842 - 80 de margens).
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 104 },
        1: { cellWidth: 76 },
        2: { cellWidth: 96 },
        3: { cellWidth: 86, fontStyle: "bold" },
        4: { cellWidth: 100 },
        5: { cellWidth: 72, halign: "left" },
        6: { halign: "center", cellWidth: 50 },
        7: { halign: "center", cellWidth: 52 },
        8: { halign: "center", cellWidth: 46 },
        9: { halign: "center", cellWidth: 14 },
        10: { halign: "center", cellWidth: 14 },
        11: { halign: "center", cellWidth: 52, fontStyle: "bold" },
      },
      didParseCell: (h: any) => {
        colorirNivel(11)(h);
        // "A avaliar" não é um nível de risco e não pode receber cor de nível.
        if (h.section === "body" && h.column.index === 11 && String(h.cell.raw ?? "") === "A avaliar") {
          h.cell.styles.fillColor = [243, 244, 246];
          h.cell.styles.textColor = [75, 85, 99];
        }
      },
      margin: { left: margin, right: margin },
    });

    // A nota substitui a frase que antes se repetia em cada linha da coluna
    // "Controles". Só aparece se alguma linha de fato caiu no padrão.
    if (linhasSemControle > 0 || linhasBaseFraca > 0) {
      let yNota = (doc as any).lastAutoTable.finalY + 10;
      const larguraNota = doc.internal.pageSize.getWidth() - margin * 2;
      rgb([90, 90, 90]); doc.setFont("helvetica", "italic"); doc.setFontSize(7.5);
      if (linhasSemControle > 0) {
        doc.text(
          'Nota: "A validar em campo" significa que a existência e a eficácia dos controles não ' +
          "foram evidenciadas no momento da avaliação — o que não equivale a afirmar que não " +
          "existam. Requer validação documental e/ou em campo pela empresa. Confirmada a ausência " +
          'na validação, a linha passa a "Não identificado na validação".',
          margin, yNota, { maxWidth: larguraNota } as any,
        );
        yNota += 20;
      }
      if (linhasBaseFraca > 0) {
        // Sem repetir o porquê do piso, que está declarado no item da
        // metodologia: aqui basta dizer o que a marca significa nesta tabela.
        doc.text(
          "Nota: nos GES marcados com * a participação foi insuficiente para classificação quantitativa. " +
          "O perigo permanece inventariado; caracterização da exposição, P, S e nível de risco ficam em " +
          "aberto até a avaliação complementar prevista no Plano de Ação.",
          margin, yNota, { maxWidth: larguraNota } as any,
        );
      }
      doc.setFont("helvetica", "normal"); rgb([30, 30, 30]);
    }

    // ---- GES cadastrados pendentes de avaliação (sem P/S, sem nível) ----
    if (!somenteAvaliados && data.gesSemAvaliacao.length > 0) {
      const pendStartY = (doc as any).lastAutoTable.finalY + 18;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); rgb(PRIMARY);
      doc.text("GES cadastrados pendentes de avaliação", margin, pendStartY);
      autoTable(doc, {
        startY: pendStartY + 8,
        head: [["GES / Setores", "Status", "Justificativa", "Ação recomendada"]],
        body: data.gesSemAvaliacao.map((g) => [
          `${g.gesFormatado} — ${g.setores.map((s) => s.setor).join(" / ")}`,
          "Pendente de avaliação",
          g.justificativa || "Sem respostas no ciclo atual",
          "Realizar avaliação psicossocial no próximo ciclo do PGR.",
        ]),
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center" },
        styles: { fontSize: 7.5, cellPadding: 3, valign: "top", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 280, fontStyle: "bold" },
          1: { cellWidth: 110, halign: "center", textColor: [180, 83, 9], fontStyle: "bold" },
          2: { cellWidth: 160 },
          3: {},
        },
        margin: { left: margin, right: margin },
      });
    }

    // A seção "Caracterização da Exposição" foi absorvida pelo Inventário.
    // Ocupava uma página retrato inteira para repetir GES e domínio e imprimir
    // três palavras (duração, frequência, intensidade) derivadas do mesmo P e S
    // que já saem no Inventário — a exigência do Guia MTE é que a caracterização
    // exista, não que ocupe seção própria, e junto da linha do risco ela é lida
    // no contexto certo.

    // Próxima seção só ganha página nova SE existir (evita página em branco).
    if (incluirPlanoAcao) {
      doc.addPage("a4", "portrait");
      y = 60;
    }




    // ============== 11. PLANO DE AÇÃO ==============
    if (incluirPlanoAcao) {
      sectionTitle("Plano de Ação Recomendado");
      paragraph(
        "Plano PRELIMINAR derivado do Inventário, e assim permanece enquanto responsável, prazo e " +
        "evidência não forem validados pela empresa. Os prazos indicados são sugestão vinculada ao " +
        "nível de risco, não prazos fixados por norma; cabe à organização defini-los na devolutiva " +
        "técnica (NR-01, item 1.5.5).",
        9,
      );


      const ordem: NivelRisco[] = ["Crítico", "Alto", "Médio", "Baixo"];
      const planoBody: any[] = [];
      const respDefault = "A definir pela empresa na devolutiva técnica";

      // Ação única para todo GES abaixo do piso amostral. Antes cada um desses
      // GES gerava sua própria linha, com ações derivadas de um percentual que
      // o Inventário já deixa em branco — o plano mandava agir sobre um risco
      // que o relatório não classificou. A única ação cabível é ir a campo.
      const ACAO_SEM_DADO =
        "Realizar avaliação complementar das condições de trabalho, com observação da atividade e " +
        "diálogo com trabalhadores, antes da classificação do risco e definição de medidas.";
      const gesSemDado = data.setores
        .filter((s) => s.fatorPrincipal && s.fatorPrincipal.n > 0 && !amostraSuficiente(s.fatorPrincipal.n))
        .map((s) => formatLabelGes(s.label));

      // Deduplicação: a recomendação vem do domínio e da faixa de percentual,
      // então GES diferentes com o mesmo domínio produziam linhas idênticas —
      // o plano de doze GES virava doze vezes a mesma ação. Agora a ação sai
      // uma vez e a coluna GES lista todos os grupos que ela cobre.
      type LinhaPlano = { acao: string; perigo: string; nivel: NivelRisco; ges: string[] };
      const agrupadas = new Map<string, LinhaPlano>();
      const acumular = (acao: string, perigo: string, nivel: NivelRisco, ges: string) => {
        const chave = `${nivel}|${perigo}|${acao}`;
        const atual = agrupadas.get(chave);
        if (atual) {
          if (!atual.ges.includes(ges)) atual.ges.push(ges);
          return;
        }
        agrupadas.set(chave, { acao, perigo, nivel, ges: [ges] });
      };

      ordem.forEach((nivel) => {
        // Prioridade e prazo seguem o Nível de Risco PGR do Inventário
        data.setores.forEach((s) => {
          const fp = s.fatorPrincipal;
          if (!fp || fp.n === 0) return;
          // GES sem base amostral não entram aqui: têm a linha única acima.
          if (!amostraSuficiente(fp.n)) return;
          const nivelPgr: NivelRisco = fp.risco.nivel;
          if (nivelPgr !== nivel) return;
          const mte = mteParaDim(fp.dim.id, nivelPgr);
          const acoes = getRecomendacoes(fp.dim.id, fp.scorePct);
          const acaoBase = acoes.length ? acoes.slice(0, 2).map((a) => "• " + a.titulo).join("\n") : "Monitorar";
          acumular(acaoBase, mte.perigo, nivelPgr, formatLabelGes(s.label));
        });
        if (data.setores.length === 0) {
          fatoresValidos
            .filter((f) => amostraSuficiente(f.n) && f.risco.nivel === nivel)
            .forEach((f) => {
              const mte = mteParaDim(f.dim.id, f.risco.nivel);
              const acoes = getRecomendacoes(f.dim.id, f.scorePct);
              const acaoTxt = acoes.length ? acoes.slice(0, 2).map((a) => "• " + a.titulo).join("\n") : "Monitorar";
              acumular(acaoTxt, mte.perigo, nivel, data.empresaNome);
            });
        }
      });

      // Cinco colunas em vez de nove. Saíram "Item" (numerar linhas não é
      // informação), "Status" e "Evidência" — sempre "A iniciar" e "A
      // registrar", que pertencem ao sistema de gestão da empresa, não à AEP —
      // e "Prioridade", que imprimia uma ordenação interna da plataforma
      // ("3ª — Média") como se fosse critério normativo.
      agrupadas.forEach((l) => {
        planoBody.push([
          l.ges.join("\n"),
          l.perigo,
          l.acao,
          respDefault,
          NIVEL_PRAZO[l.nivel],
        ]);
      });

      // A linha dos GES sem dado fecha o plano: é pré-requisito das demais
      // medidas naqueles grupos, não uma ação de mesma natureza.
      if (gesSemDado.length > 0) {
        planoBody.push([
          gesSemDado.join("\n"),
          "Risco psicossocial não classificado",
          ACAO_SEM_DADO,
          respDefault,
          "A definir",
        ]);
      }

      autoTable(doc, {
        startY: y,
        head: [["GES / Setores", "Fator identificado", "Medida recomendada", "Responsável", "Prazo"]],
        body: planoBody.length ? planoBody : [["—", "Sem ações no recorte", "—", "—", "—"]],
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center" },
        styles: { fontSize: 8, cellPadding: 4, valign: "top", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        // Soma = 515pt, a área útil da A4 retrato (595,28 - 2 x 40).
        columnStyles: {
          0: { cellWidth: 110, fontStyle: "bold" },
          1: { cellWidth: 105 },
          2: { cellWidth: 155 },
          3: { cellWidth: 75 },
          4: { cellWidth: 70, halign: "center" },
        },
        rowPageBreak: "avoid",
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      // A ressalva de que a classificação psicossocial é só apoio interpretativo
      // já abre esta mesma seção; repeti-la depois da tabela não acrescenta.
      y += 8;
    }

    // ============== 12. CONCLUSÃO TÉCNICA ==============
    sectionTitle("Conclusão Técnica");
    // A conclusão diz duas coisas: o que a avaliação identificou e o que ficou
    // pendente. O bloco anterior tinha cinco parágrafos e terminava com "o
    // documento não constitui inventário de riscos concluído" — o relatório se
    // desqualificando no fecho. A AEP é documento técnico próprio que SUBSIDIA
    // o PGR; dizer isso uma vez, no início, basta.
    const totalSem = data.gesSemAvaliacao.length;
    const gesSemBase = data.setores.filter(
      (g) => g.fatorPrincipal && g.fatorPrincipal.n > 0 && !amostraSuficiente(g.fatorPrincipal.n),
    ).length;

    paragraph(
      "A avaliação identificou fatores psicossociais que devem ser considerados no gerenciamento " +
      "dos riscos ocupacionais." +
      (gesSemBase > 0
        ? " Os resultados dos GES com participação insuficiente requerem avaliação complementar das " +
          "condições de trabalho antes de sua classificação."
        : "")
    );

    // Ressalva de amostra no nível do documento inteiro: uma AEP de três
    // respondentes não pode ser lida como uma AEP qualquer.
    if (!amostraSuficiente(data.totalRespostas)) {
      callout(
        `RESSALVA DE AMOSTRA: a avaliação reuniu ${data.totalRespostas} resposta(s) válida(s). Os ` +
        "resultados têm caráter exploratório e não sustentam afirmação de presença nem de ausência " +
        "de risco psicossocial na organização.",
        NIVEL_COR["Alto"],
      );
    }

    if (totalSem > 0) {
      paragraph(
        `Os ${totalSem} GES sem respostas neste ciclo devem ser priorizados na próxima aplicação ou ` +
        "ter a ausência de participantes formalmente justificada.",
        9,
      );
    }





    // O Anexo I (mapeamento técnico do Guia MTE) saiu: era um dicionário de
    // domínio → agente → perigo → consequência que apenas repetia, em outra
    // disposição, o que o Inventário já traz linha a linha para os GES reais.
    // O Anexo II virou esta linha, dentro da própria Conclusão: uma seção
    // numerada, com título e badge, para exibir três siglas custava mais
    // espaço do que o texto que carregava — e o que cada norma é já foi dito
    // na Introdução e na Metodologia.
    if (incluirAnexos) {
      paragraph("Base normativa: NR-01, NR-17 e Guia MTE de Fatores de Riscos Psicossociais.", 9);
    }

    // ----- Bloco de assinatura do Responsável Técnico -----
    {
      const rt = data.responsavelTec;
      const nome = (rt?.nome || data.responsavelTecnico || "").trim();
      const form = (rt?.formacao || (data.empresa as any)?.resp_formacao || "").trim();
      const reg = (rt?.registro || (data.empresa as any)?.resp_registro || "").trim();
      const cargo = (rt?.cargo || (data.empresa as any)?.responsavel_cargo || "")
        .trim()
        .replace(/Segurnça/gi, "Segurança")
        .replace(/Seguranca/g, "Segurança");
      const dataE = (rt?.dataEmissao || data.emitidoEm.slice(0, 10));
      // 82pt é o que o bloco realmente ocupa (linha + 4 linhas de 12pt).
      // Reservando 150 + 24 de folga ele caía sozinho na última página.
      ensure(82);
      y += 8;
      doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.5);
      const lineY = y + 16;
      doc.line(margin + 60, lineY, pageW - margin - 60, lineY);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); rgb(PRIMARY);
      doc.text(nome || "Responsável Técnico", pageW / 2, lineY + 13, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); rgb([60, 60, 60]);
      const linha2 = [form, reg].filter(Boolean).join(" — ") || "Formação / Registro Profissional";
      doc.text(linha2, pageW / 2, lineY + 25, { align: "center" });
      if (cargo) doc.text(cargo, pageW / 2, lineY + 37, { align: "center" });
      doc.text(`Data de emissão: ${dataE}`, pageW / 2, lineY + 49, { align: "center" });
      y = lineY + 60;
    }

    // ============== Remoção de páginas vazias ==============
    // Detecta páginas sem conteúdo desenhado (criadas por overflow de tabelas
    // ou transições) e as remove ANTES de pintar cabeçalho/rodapé, para que
    // o relatório nunca exiba uma página com apenas o rodapé.
    {
      const internalPages: any[] = (doc as any).internal.pages;
      // internal.pages[0] é placeholder; páginas reais começam em 1
      for (let p = internalPages.length - 1; p >= 2; p--) {
        const ops = internalPages[p];
        const streamLen = Array.isArray(ops) ? ops.join("").length : 0;
        // Página verdadeiramente vazia tem stream muito curto (< 120 chars).
        // Páginas com tabela/título têm milhares de chars.
        if (streamLen < 120) {
          (doc as any).deletePage(p);
        }
      }
    }

    // ============== Cabeçalho/rodapé ==============
    const pages = doc.getNumberOfPages();

    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      fillRgb(PRIMARY);
      doc.rect(0, 0, pageW, 18, "F");
      rgb([255, 255, 255]); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("AEP — AVALIAÇÃO ERGONÔMICA PRELIMINAR  •  RISCOS PSICOSSOCIAIS", margin, 12);
      doc.setFont("helvetica", "normal");
      doc.text(truncate(data.empresaNome, 50), pageW - margin, 12, { align: "right" });
      doc.setDrawColor(220); doc.setLineWidth(0.4);
      doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
      rgb([110, 110, 110]); doc.setFontSize(8);
      doc.text("PSICOSAFETY  •  NR-01 / NR-17 / Guia MTE", margin, pageH - 16);
      doc.text(`Página ${p} de ${pages}`, pageW - margin, pageH - 16, { align: "right" });

      // Marca d'água "RASCUNHO" quando emitido em modo prévia
      if (data.rascunho) {
        const curPageW = doc.internal.pageSize.getWidth();
        const curPageH = doc.internal.pageSize.getHeight();
        doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
        doc.setFont("helvetica", "bold"); doc.setFontSize(70); doc.setTextColor(220, 38, 38);
        doc.text("RASCUNHO", curPageW / 2, curPageH / 2, { align: "center", angle: 30 });
        doc.setFontSize(14);
        doc.text("NÃO VÁLIDO PARA FISCALIZAÇÃO", curPageW / 2, curPageH / 2 + 50, { align: "center", angle: 30 });
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
        doc.setTextColor(40, 40, 40);
      }
    }

    void ({} as LinhaFator);

    step("salvando arquivo");
    console.log(
      "[AUDITORIA-CONTROLES] resumo — mapa:", opts.controlesMap?.size ?? 0,
      "lookups:", controlesLookupCount,
      "controles_aplicados_pdf:", controlesAplicadosCount,
    );
    if ((opts.controlesMap?.size ?? 0) > 0 && controlesAplicadosCount === 0) {
      console.warn(
        "[AUDITORIA-CONTROLES] ⚠️ Existem controles cadastrados, mas nenhum casou com um GES/domínio do Inventário.",
        "Verifique se o Domínio COPSOQ do controle bate com a dimensão do fator principal do GES.",
      );
    }
    const fileName = `AEPPSICOSAFETY-${slug(data.empresaNome)}.pdf`;
    doc.save(fileName);
    toast.success("Relatório AEP gerado com sucesso");
  } catch (err: any) {
    console.error("[AEP-PDF] falha interna:", err);
    if (opts.throwOnError) throw err;
    toast.error("Falha ao gerar PDF: " + (err?.message ?? String(err)), { duration: 10000 });
  }
}



// Helper de coloração de coluna por nível
function colorirNivel(colIdx: number, _ord: boolean = false) {
  return (h: any) => {
    if (h.section === "body" && h.column.index === colIdx) {
      const raw = String(h.cell.raw ?? "").toUpperCase();
      const map: Record<string, NivelRisco> = { BAIXO: "Baixo", MÉDIO: "Médio", ALTO: "Alto", CRÍTICO: "Crítico" };
      let lvl: NivelRisco | undefined = map[raw];
      if (!lvl) {
        // Nomenclatura PGR 5x5 → cor equivalente do nível psicossocial 4
        if (raw.startsWith("INTOLER")) lvl = "Crítico";
        else if (raw.startsWith("SUBSTANC")) lvl = "Alto";
        else if (raw.startsWith("MODERAD")) lvl = "Médio";
        else if (raw.startsWith("TOLER") || raw.startsWith("TRIVIAL")) lvl = "Baixo";
        else if (raw.includes("IMEDIATA") || raw.includes("CRÍTIC")) lvl = "Crítico";
        else if (raw.includes("ALTA")) lvl = "Alto";
        else if (raw.includes("MÉDIA")) lvl = "Médio";
        else if (raw.includes("MONITORAR") || raw.includes("BAIX")) lvl = "Baixo";
      }
      if (lvl) {
        h.cell.styles.fillColor = NIVEL_FILL[lvl];
        h.cell.styles.textColor = NIVEL_COR[lvl];
      }
    }
  };
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function slug(s: string) { return s.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }

// jsPDF.splitTextToSize quebra apenas em espaços normais (" "), nunca dentro
// de uma palavra — desde que cada palavra individual caiba na largura da
// coluna. NBSP-juntar todas as palavras de uma frase forma um único token
// gigante que NÃO cabe, forçando o fallback char-level (quebra no meio).
// Por isso aqui apenas normalizamos o whitespace e devolvemos a string como
// está: quebra ocorre entre palavras, depois de vírgulas, barras e travessões.
function protectWords(s: string): string {
  if (!s) return "—";
  return s.replace(/\s+/g, " ").trim();
}

// Formata "GES 08 — ALMOXARIFADO" em duas linhas, quebrando APENAS entre
// nomes de setores — nunca no meio de uma palavra. Espaços internos do nome
// do setor viram NBSP (\u00A0) para impedir que o autoTable quebre palavras
// como "PACK EXPEDIÇÃO" no meio. O separador " / " entre setores permanece
// como espaço normal — é o único ponto válido de quebra de linha.
//   "GES 05 — PACK / EXPEDIÇÃO / SEPARAÇÃO"  →  "GES 05 —\nPACK / EXPEDIÇÃO / SEPARAÇÃO"
function formatLabelGes(label: string): string {
  if (!label) return "—";
  const m = label.match(/^(GES\s*\d+)\s*[—\-–]\s*(.+)$/i);
  if (!m) {
    // Sem prefixo GES — ainda assim protege espaços internos
    return (label || "—").replace(/\s+/g, "\u00A0");
  }
  const prefixo = m[1].toUpperCase().replace(/\s+/g, "\u00A0") + "\u00A0—";
  const setores = m[2]
    .split(/\s*[\/,]\s*/)
    .map((s) => s.trim().replace(/\s+/g, "\u00A0"))
    .filter(Boolean);
  if (setores.length === 0) return prefixo;
  return `${prefixo}\n${setores.join(" / ")}`;
}
