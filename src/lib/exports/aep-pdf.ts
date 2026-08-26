// =====================================================================
// AEP — AVALIAÇÃO ERGONÔMICA PRELIMINAR
// FOCO: RISCOS PSICOSSOCIAIS (NR-01 / NR-17)
// Estrutura técnico-legal premium — 13 seções
// Lógica: COPSOQBR → Agente/Situação → Perigo → Consequência (Guia MTE) →
//          Prob × Sev → Nível → Inventário PGR → Plano de Ação
// =====================================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import aepCoverUrl from "@/assets/aep-cover.png";
import { getRecomendacoes } from "@/lib/recomendacoes";
import {
  type AepDataset,
  type LinhaFator,
  type NivelRisco,
  type Nivel5,
  classificarRisco,
  nivel5FromValor,
  NIVEL5_COR,
  NIVEL5_FILL,
  NIVEL5_FAIXA,
  mteParaDim,
  MTE_MAPA,
  caracterizarExposicao,
  assertAgrupamentoGesAplicado,
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

function createProbabilityAxisPng(widthPt: number, heightPt: number): string | null {
  if (typeof document === "undefined") return null;

  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthPt * scale);
  canvas.height = Math.round(heightPt * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#0f172a";
  ctx.font = `${11 * scale}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PROBABILIDADE", 0, 0);
  ctx.restore();

  return canvas.toDataURL("image/png");
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

const NIVEL_PRIORIDADE: Record<NivelRisco, string> = {
  Crítico: "1ª — Imediata",
  Alto:    "2ª — Alta",
  Médio:   "3ª — Média",
  Baixo:   "4ª — Monitorar",
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
    const sectionTitle = (titulo: string, opts?: { samePageIfFits?: number }) => {
      step(`seção: ${titulo}`);

      // Por padrão cada capítulo principal inicia em nova página.
      // Se samePageIfFits for informado e couber na página atual, mantém na mesma página.
      if (secCount > 0) {
        const fits = opts?.samePageIfFits && (y + opts.samePageIfFits <= pageH - 60);
        if (!fits) { doc.addPage(); y = margin + 30; }
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

    // ============== CAPA ==============
    try {
      const coverDataUrl = await urlToDataUrl(aepCoverUrl);
      doc.addImage(coverDataUrl, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    } catch {
      fillRgb(PRIMARY); doc.rect(0, 0, pageW, pageH, "F");
      rgb([255, 255, 255]);
      doc.setFont("helvetica", "bold"); doc.setFontSize(28);
      doc.text("AEP", margin, pageH / 2 - 60);
      doc.setFontSize(20);
      doc.text("AVALIAÇÃO ERGONÔMICA PRELIMINAR", margin, pageH / 2 - 30);
      doc.setFontSize(13); doc.setFont("helvetica", "normal");
      doc.text("Foco: Riscos Psicossociais  •  NR-01 / NR-17 / Guia MTE", margin, pageH / 2);
      doc.setFontSize(11);
      doc.text(data.empresaNome, margin, pageH / 2 + 30);
      doc.text(`Emitido em ${data.emitidoEm}`, margin, pageH / 2 + 48);
    }

    // ============== 01. DADOS DA EMPRESA ==============
    doc.addPage(); y = margin + 10;
    fillRgb(PRIMARY); doc.roundedRect(margin, y, pageW - margin * 2, 56, 8, 8, "F");
    rgb([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("RELATÓRIO TÉCNICO AEP — RISCOS PSICOSSOCIAIS", margin + 16, y + 22);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); rgb([191, 219, 254]);
    doc.text("Avaliação Ergonômica Preliminar  •  Conforme NR-01, NR-17 e Guia MTE", margin + 16, y + 40);
    y += 70;

    sectionTitle("Dados da Empresa");
    const e = data.empresa;
    const setoresLista = data.setores.length > 0
      ? data.setores.map((s) => s.label).join(", ")
      : "—";
    const dataAval = data.periodo.inicio || data.periodo.fim
      ? `${data.periodo.inicio ?? "-"} a ${data.periodo.fim ?? "-"}`
      : data.emitidoEm.slice(0, 10);

    const gesCadStr = data.gesCadastrados.length
      ? data.gesCadastrados.map((g) => `• ${g.label}`).join("\n")
      : "—";
    const gesAvaStr = data.gesAvaliados.length
      ? data.gesAvaliados.map((g) => `• ${g.label}`).join("\n")
      : "—";
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

    const linhasEmpresa: any[] = [
      ["Razão Social", (e as any)?.razao_social ?? e?.nome ?? data.empresaNome],
      ["Nome Fantasia", e?.nome ?? "—"],
      ["CNPJ", e?.cnpj ?? "—"],
      ["CNAE", (e as any)?.cnae ?? "—"],
      ["Endereço", (e as any)?.endereco ?? "—"],
      ["Grau de Risco", (e as any)?.grau_risco ?? "—"],
    ];
    // Trabalhadores cadastrados: só mostra se houver valor real
    if (trabCad !== "—" && trabCad != null && String(trabCad).trim() !== "") {
      linhasEmpresa.push(["Trabalhadores cadastrados na empresa", String(trabCad)]);
    }
    linhasEmpresa.push(["Trabalhadores participantes / respondentes válidos", String(data.totalRespostas)]);
    if (!somenteAvaliados) {
      linhasEmpresa.push(["Trabalhadores abrangidos pelos GES avaliados", String(trabAbr)]);
      linhasEmpresa.push([`GES cadastrados no sistema (${totCad})`, gesCadStr]);
    }
    linhasEmpresa.push([`GES avaliados neste relatório (${totAva})`, gesAvaStr]);
    if (!somenteAvaliados) {
      linhasEmpresa.push([`GES sem avaliação neste ciclo (${totSem})`, gesSemStr]);
    }
    linhasEmpresa.push(["GES Avaliados (consolidado)", setoresLista]);
    linhasEmpresa.push(["Data da Avaliação", dataAval]);
    linhasEmpresa.push(["Responsável Técnico", respNome]);
    linhasEmpresa.push(["Formação", respForm]);
    linhasEmpresa.push(["Registro Profissional", respReg]);
    linhasEmpresa.push(["Cargo", respCargo]);

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

    // ============== 02. SUMÁRIO ==============
    sectionTitle("Sumário");
    const sumario = [
      ["01", "Dados da Empresa"],
      ["02", "Sumário"],
      ["03", "Introdução"],
      ["04", "Metodologia Aplicada"],
      ["05", "Caracterização dos GES / Setores / Funções Avaliadas"],
      ["06", "Resultado da Avaliação do Questionário COPSOQBR"],
      ["07", "Distribuição dos Resultados por Domínio / GES"],
      ["08", "Conclusões e Recomendações Preliminares"],
      ["09", "Classificação e Avaliação dos Riscos Psicossociais"],
      ["10", "Inventário de Riscos Ocupacionais para o PGR"],
      ["11", "Caracterização da Exposição"],
      ["12", "Plano de Ação Recomendado"],
      ["13", "Conclusão Técnica"],
      ["14", "Anexos"],
    ];
    autoTable(doc, {
      startY: y,
      body: sumario,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 40, halign: "center", fontStyle: "bold", textColor: ACCENT },
        1: { textColor: PRIMARY },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 18;

    // ============== 03. INTRODUÇÃO ==============
    sectionTitle("Introdução");
    paragraph(
      "A Avaliação Ergonômica Preliminar (AEP) integra as ações de identificação, reconhecimento e " +
      "avaliação dos riscos ocupacionais da empresa, conforme determinam a NR-01 (Gerenciamento de " +
      "Riscos Ocupacionais — GRO/PGR) e a NR-17 (Ergonomia). Esta avaliação fornece subsídios técnicos " +
      "para a composição do Inventário de Riscos do PGR e, quando indicado, para a realização da " +
      "Análise Ergonômica do Trabalho (AET) aprofundada."
    );
    paragraph(
      "Os fatores psicossociais aqui avaliados são tratados como riscos ocupacionais relacionados à " +
      "organização do trabalho, à gestão e às relações no ambiente laboral. NÃO se trata de diagnóstico " +
      "clínico individual: o foco é ocupacional, organizacional e preventivo, com linguagem alinhada ao " +
      "Guia de Fatores de Riscos Psicossociais Relacionados ao Trabalho do MTE."
    );
    callout(
      "Este relatório não substitui avaliação clínica individual. Os resultados refletem a percepção " +
      "coletiva dos trabalhadores no momento da aplicação e devem subsidiar decisões de prevenção, " +
      "controle e mitigação de riscos ocupacionais conforme NR-01.",
      ACCENT,
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

    paragraph(
      "A metodologia está organizada em duas camadas complementares, para evitar sobreposição " +
      "de conceitos: (1) avaliação psicossocial pelo COPSOQBR, que gera a Classificação " +
      "Psicossocial em percentual de criticidade; e (2) integração ocupacional ao GRO/PGR, que " +
      "aplica a matriz Probabilidade × Severidade e gera o Nível de Risco PGR, o Inventário de " +
      "Riscos e o Plano de Ação."
    );

    subTitle("4.1 Coleta dos dados");
    paragraph(
      "Aplicação do questionário COPSOQBR (versão brasileira do COPSOQ III) aos trabalhadores " +
      "participantes, com respostas anônimas e tratamento coletivo. A finalidade é ocupacional " +
      "e preventiva — o relatório não possui finalidade diagnóstica clínica individual."
    );

    subTitle("4.2 Tratamento dos resultados psicossociais");
    paragraph(
      "As respostas são consolidadas por domínio do COPSOQBR e convertidas em percentual de " +
      "criticidade, representando a percepção coletiva dos trabalhadores. A Classificação " +
      "Psicossocial segue as faixas: 0–33% = BAIXO · 34–66% = MÉDIO · 67–100% = ALTO."
    );

    subTitle("4.3 Mapeamento técnico ocupacional");
    paragraph(
      "Cada domínio do COPSOQBR é relacionado a um agente / situação, a um perigo (fator de " +
      "risco) e a uma possível consequência, utilizando nomenclatura alinhada ao Guia de " +
      "Fatores de Riscos Psicossociais Relacionados ao Trabalho do MTE."
    );

    subTitle("4.4 Integração ao GRO/PGR");
    paragraph(
      "Após a Classificação Psicossocial, os achados são integrados ao Inventário de Riscos do " +
      "PGR por meio da matriz Probabilidade × Severidade (5×5), gerando o Nível de Risco PGR. " +
      "A matriz 5×5 foi adotada como critério técnico interno para integração dos achados " +
      "psicossociais ao Inventário de Riscos do PGR — ela não representa o resultado direto do " +
      "COPSOQBR, mas sim a etapa de integração ocupacional."
    );

    subTitle("4.5 Inventário de Riscos e Plano de Ação");
    paragraph(
      "O Inventário de Riscos apresenta os perigos psicossociais reconhecidos, controles " +
      "existentes, probabilidade, severidade e Nível de Risco PGR. O Plano de Ação é derivado " +
      "do Inventário, com prazos e prioridades definidos a partir do Nível de Risco PGR."
    );

    callout(
      "COPSOQBR = percentual e Classificação Psicossocial. " +
      "PGR = matriz P × S, Nível de Risco, Inventário e Plano de Ação. " +
      "Os dois conceitos são complementares e não devem ser confundidos.",
      ACCENT,
    );


    // ============== 05. GES / SETORES / FUNÇÕES ==============
    sectionTitle("Caracterização dos GES / Setores / Funções Avaliadas");
    paragraph(
      "Identificação dos Grupos de Exposição Similar (GES) avaliados, suas funções, número de " +
      "trabalhadores e a representatividade na amostra. Esta seção é apenas de caracterização — " +
      "a análise de risco psicossocial é apresentada nas seções 06 a 10."
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
          String(s.n),
          `${part}%`,
        ];
      });
      autoTable(doc, {
        startY: y,
        head: [["GES / Setores", "Funções avaliadas", "Nº\nTrab.", "Resp.\nválidas", "% da\namostra"]],
        body: gheBody,
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center", valign: "middle", cellPadding: 4 },
        styles: { fontSize: 8, cellPadding: 3.5, valign: "middle", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 150, halign: "left" },
          1: { cellWidth: 230 },
          2: { halign: "center", cellWidth: 40 },
          3: { halign: "center", cellWidth: 45 },
          4: { halign: "center", cellWidth: 55 },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 18;

      // Observação técnica: GES com baixa amostra + diferenciação trabalhadores × respostas
      paragraph(
        "Observação: a coluna \"Nº Trab.\" refere-se ao total de trabalhadores existentes no GES/Setor conforme cadastro da empresa; " +
        "\"Resp. válidas\" indica quantos participaram efetivamente da avaliação; e \"% da amostra\" representa a taxa de participação " +
        "do GES em relação ao total de respondentes. Quando o cadastro de trabalhadores por GES não estiver disponível, os valores " +
        "podem coincidir e devem ser validados pela empresa. GES com baixa quantidade de respostas devem ser interpretados como " +
        "recorte preliminar, recomendando validação complementar quando houver maior número de trabalhadores no setor.",
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


    // ============== 06. RESULTADO DA AVALIAÇÃO COPSOQBR ==============
    sectionTitle("Resultado da Avaliação do Questionário COPSOQBR");
    paragraph(
      "Os resultados abaixo representam exclusivamente a consolidação dos domínios avaliados pelo " +
      "COPSOQBR, com percentual de criticidade e Classificação Psicossocial. A conversão técnica em " +
      "perigo, possível consequência, controles e nível de risco PGR é apresentada posteriormente no " +
      "Inventário de Riscos Ocupacionais (seções 09 e 10). Faixas: 0–33% = BAIXO · 34–66% = MÉDIO · 67–100% = ALTO."
    );

    const fatoresValidos = data.fatoresGerais.filter((f) => f.n > 0);

    const leituraPreventivaPorDim: Record<string, string> = {
      demandas: "Indica atenção para sobrecarga, pressão, múltiplas tarefas e ritmo intenso de trabalho.",
      organizacao: "Indica atenção para autonomia, controle da tarefa, clareza de papéis e organização do trabalho.",
      relacoes: "Indica atenção para relações interpessoais, comunicação, apoio da liderança e clima da equipe.",
      interface: "Indica atenção para o equilíbrio entre trabalho e vida pessoal e a interferência do trabalho no tempo pessoal.",
      saude: "Indica atenção para sinais de estresse, esgotamento, sono e bem-estar geral relacionados ao trabalho.",
      ofensivos: "Indica atenção para situações de assédio moral, sexual, humilhação, intimidação ou discriminação.",
      seguranca: "Indica atenção para percepção de insegurança ocupacional, falhas de comunicação preventiva e confiança nas condições de trabalho.",
      reconhecimento: "Indica atenção para reconhecimento profissional, justiça organizacional, valorização e feedback.",
    };

    const resultadoBody = fatoresValidos.length
      ? fatoresValidos.map((f) => {
          let classif = f.classifPsico.toUpperCase();
          if (f.scorePct >= 34 && f.scorePct <= 66 && classif === "BAIXO") {
            classif = "MÉDIO";
            // eslint-disable-next-line no-console
            console.warn(`[AEP] Inconsistência de classificação em "${f.dim.title}" (${f.scorePct}%): percentual médio não pode ser classificado como baixo. Corrigido para MÉDIO.`);
          }
          const leitura =
            leituraPreventivaPorDim[f.dim.id] ??
            "Consolidação da percepção coletiva dos trabalhadores para este domínio psicossocial.";
          return [f.dim.title, `${f.scorePct}%`, classif, leitura];
        })
      : [["—", "—", "—", "—"]];

    autoTable(doc, {
      startY: y,
      head: [["Domínio COPSOQBR", "%", "Classif.\nPsicoss.", "Leitura técnica preventiva"]],
      body: resultadoBody,
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center", valign: "middle" },
      styles: { fontSize: 8, cellPadding: 3.5, valign: "top" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 95 },
        1: { halign: "center", cellWidth: 30, fontStyle: "bold" },
        2: { halign: "center", cellWidth: 50, fontStyle: "bold" },
        3: { cellWidth: "auto" },
      },
      didParseCell: (h) => {
        if (h.section === "body" && h.column.index === 2) {
          const map: Record<string, NivelRisco> = { BAIXO: "Baixo", MÉDIO: "Médio", ALTO: "Alto", CRÍTICO: "Crítico" };
          const lvl = map[String(h.cell.raw)];
          if (lvl) { h.cell.styles.fillColor = NIVEL_FILL[lvl]; h.cell.styles.textColor = NIVEL_COR[lvl]; }
        }
      },
      margin: { left: margin, right: margin },
    });


    y = (doc as any).lastAutoTable.finalY + 18;

    // ============== 07. DISTRIBUIÇÃO POR GES ==============
    sectionTitle("Distribuição dos Resultados por Domínio / GES");
    paragraph(
      "Visão consolidada por GES com o domínio psicossocial crítico, o percentual de criticidade e a " +
      "classificação psicossocial correspondente. Perigos, possíveis consequências e matriz PGR " +
      "(Probabilidade × Severidade) são apresentados nas seções 09 e 10."
    );
    paragraph(
      "Observação técnica: o resultado geral do COPSOQBR representa a consolidação das respostas de " +
      "todos os GES avaliados. Já a distribuição por GES apresenta a criticidade específica de cada " +
      "grupo. Por isso, um GES pode apresentar classificação psicossocial superior ao resultado geral " +
      "da empresa para determinado domínio."
    );

    if (data.setores.length === 0) {
      paragraph("Sem dados por setor no recorte.");
    } else {
      const distBody: any[] = [];
      data.setores.forEach((s) => {
        const fp = s.fatorPrincipal;
        if (!fp || fp.n === 0) return;
        distBody.push([
          formatLabelGes(s.label),
          fp.dim.title,
          `${fp.scorePct}%`,
          fp.classifPsico.toUpperCase(),
        ]);
      });

      autoTable(doc, {
        startY: y,
        head: [["GES / Setores", "Domínio crítico", "%", "Classif.\nPsicoss."]],
        body: distBody.length ? distBody : [["—", "—", "—", "—"]],
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9, halign: "center" },
        styles: { fontSize: 9, cellPadding: 4, valign: "middle", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 200 },
          1: { cellWidth: 160 },
          2: { halign: "center", cellWidth: 40, fontStyle: "bold" },
          3: { halign: "center", cellWidth: 90, fontStyle: "bold" },
        },
        didParseCell: (h) => {
          if (h.section === "body" && h.column.index === 3) {
            const raw = String(h.cell.raw ?? "").toUpperCase();
            const map: Record<string, NivelRisco> = { BAIXO: "Baixo", MÉDIO: "Médio", ALTO: "Alto", CRÍTICO: "Crítico" };
            const lvl = map[raw];
            if (lvl) { h.cell.styles.fillColor = NIVEL_FILL[lvl]; h.cell.styles.textColor = NIVEL_COR[lvl]; }
          }
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // ============== 08. CONCLUSÕES E RECOMENDAÇÕES PRELIMINARES ==============
    sectionTitle("Conclusões e Recomendações Preliminares");

    const classifRankTop: Record<string, number> = { CRÍTICO: 4, ALTO: 3, MÉDIO: 2, BAIXO: 1 };
    const topDominios = [...fatoresValidos]
      .filter((f) => (f.classifPsico ?? "").toUpperCase() !== "BAIXO")
      .sort((a, b) => {
        const ca = classifRankTop[(a.classifPsico ?? "").toUpperCase()] ?? 0;
        const cb = classifRankTop[(b.classifPsico ?? "").toUpperCase()] ?? 0;
        if (cb !== ca) return cb - ca;
        return b.scorePct - a.scorePct;
      })
      .slice(0, 5);
    const classifRank: Record<string, number> = { CRÍTICO: 4, ALTO: 3, MÉDIO: 2, BAIXO: 1 };
    const setoresCriticos = [...data.setores]
      .filter((s) => {
        const c = (s.fatorPrincipal?.classifPsico ?? "").toUpperCase();
        return c && c !== "BAIXO";
      })
      .sort((a, b) => {
        const ca = classifRank[(a.fatorPrincipal?.classifPsico ?? "").toUpperCase()] ?? 0;
        const cb = classifRank[(b.fatorPrincipal?.classifPsico ?? "").toUpperCase()] ?? 0;
        if (cb !== ca) return cb - ca;
        return (b.fatorPrincipal?.scorePct ?? 0) - (a.fatorPrincipal?.scorePct ?? 0);
      })
      .slice(0, 5);

    subTitle("Priorização dos domínios com maior risco");
    autoTable(doc, {
      startY: y,
      head: [["#", "Domínio COPSOQBR", "%", "Classif.\nPsicoss."]],
      body: topDominios.length
        ? topDominios.map((f, i) => [String(i + 1), f.dim.title, `${f.scorePct}%`, f.classifPsico.toUpperCase()])
        : [["—", "Sem dados no recorte", "—", "—"]],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9, halign: "center" },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { halign: "center", cellWidth: 30, fontStyle: "bold" },
        1: { fontStyle: "bold" },
        2: { halign: "center", cellWidth: 60 },
        3: { halign: "center", fontStyle: "bold", cellWidth: 110 },
      },
      didParseCell: colorirNivel(3),
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 14;


    subTitle("Priorização dos GES mais críticos");
    autoTable(doc, {
      startY: y,
      head: [["#", "GES / Setores", "Domínio crítico", "%", "Classif.\nPsicoss."]],
      body: setoresCriticos.length
        ? setoresCriticos.map((s, i) => [
            String(i + 1),
            formatLabelGes(s.label),
            s.fatorPrincipal?.dim.title ?? "—",
            s.fatorPrincipal ? `${Math.round(s.fatorPrincipal.scorePct)}%` : "—",
            (s.fatorPrincipal?.classifPsico ?? "—").toUpperCase(),
          ])
        : [["—", "Sem dados", "—", "—", "—"]],

      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9, halign: "center" },
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      columnStyles: {
        0: { halign: "center", cellWidth: 30, fontStyle: "bold" },
        1: { fontStyle: "bold", cellWidth: 150 },
        2: { cellWidth: 140 },
        3: { halign: "center", cellWidth: 40, fontStyle: "bold" },
        4: { halign: "center", fontStyle: "bold", cellWidth: 90 },
      },
      didParseCell: (h) => {
        if (h.section === "body" && h.column.index === 4) {
          const raw = String(h.cell.raw ?? "").toUpperCase();
          const map: Record<string, NivelRisco> = { BAIXO: "Baixo", MÉDIO: "Médio", ALTO: "Alto", CRÍTICO: "Crítico" };
          const lvl = map[raw];
          if (lvl) { h.cell.styles.fillColor = NIVEL_FILL[lvl]; h.cell.styles.textColor = NIVEL_COR[lvl]; }
        }
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 14;


    paragraph(
      "As recomendações preventivas detalhadas e o plano de ação estão apresentados na seção 11 — Plano de Ação Recomendado, elaborado a partir do Inventário de Riscos Ocupacionais para o PGR."
    );




    // ============== 09. CLASSIFICAÇÃO E AVALIAÇÃO DOS RISCOS PSICOSSOCIAIS ==============
    sectionTitle("Classificação e Avaliação dos Riscos Psicossociais");
    paragraph(
      "A classificação utiliza a matriz 5×5 (Probabilidade × Severidade), adotada como critério " +
      "técnico interno para integração dos achados psicossociais ao Inventário de Riscos do PGR " +
      "(NR-01 / GRO), resultando nas categorias TRIVIAL, TOLERÁVEL, MODERADO, SUBSTANCIAL e " +
      "INTOLERÁVEL."
    );

    // ---- Matriz 5x5 ----
    ensure(260);
    const matProbAxisW = 56;       // célula própria do eixo "PROBABILIDADE"
    const matRowLabelW = 70;       // coluna dos rótulos das linhas (MUITO PROVÁVEL, etc.)
    const matLegendW = 90;
    const matCellW = (pageW - margin * 2 - matProbAxisW - matRowLabelW - matLegendW) / 5;
    const matCellH = 32;
    const matX = margin + matProbAxisW + matRowLabelW;
    const matY = y + matCellH;

    // Cabeçalho topo: faixa MATRIZ 5x5 (sobre área dos rótulos) e SEVERIDADE (sobre células)
    fillRgb(PRIMARY);
    doc.rect(margin, y, matProbAxisW + matRowLabelW, matCellH, "F");
    doc.rect(matX, y, matCellW * 5, matCellH, "F");
    rgb([255, 255, 255]); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("MATRIZ 5×5", margin + (matProbAxisW + matRowLabelW) / 2, y + matCellH / 2 + 3, { align: "center" });
    doc.text("SEVERIDADE", matX + (matCellW * 5) / 2, y + matCellH / 2 + 3, { align: "center" });

    // Linha de rótulos da severidade
    const sevLabels = ["LEVE\n1", "BAIXO\n2", "MODERADO\n3", "ALTO\n4", "EXTREMO\n5"];
    const probLabels = ["MUITO PROVÁVEL\n5", "PROVÁVEL\n4", "POSSÍVEL\n3", "POUCO PROVÁVEL\n2", "RARA\n1"];
    const probVals = [5, 4, 3, 2, 1];

    fillRgb([239, 246, 255]);
    doc.rect(matX, matY, matCellW * 5, matCellH, "F");
    rgb(PRIMARY); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    sevLabels.forEach((lbl, i) => {
      const parts = lbl.split("\n");
      doc.text(parts[0], matX + matCellW * i + matCellW / 2, matY + 13, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(parts[1], matX + matCellW * i + matCellW / 2, matY + 24, { align: "center" });
      doc.setFont("helvetica", "bold");
    });

    // Eixo PROBABILIDADE: célula cinza estrutural, integrada à matriz e sem texto sobreposto fora do bloco
    const probStripY = matY + matCellH;
    const probStripH = matCellH * 5;
    fillRgb([229, 231, 235]);
    doc.rect(margin, probStripY, matProbAxisW, probStripH, "F");
    const probAxisPng = createProbabilityAxisPng(matProbAxisW, probStripH);
    if (probAxisPng) {
      doc.addImage(probAxisPng, "PNG", margin, probStripY, matProbAxisW, probStripH, undefined, "FAST");
    } else {
      rgb(PRIMARY); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("Probabilidade", margin + matProbAxisW / 2, probStripY + 14, { align: "center" });
    }

    probVals.forEach((p, rowIdx) => {
      const ry = matY + matCellH + rowIdx * matCellH;
      // Rótulo da linha
      fillRgb([248, 250, 252]);
      doc.rect(margin + matProbAxisW, ry, matRowLabelW, matCellH, "F");
      rgb(PRIMARY); doc.setFontSize(6.8); doc.setFont("helvetica", "bold");
      const ls = probLabels[rowIdx].split("\n");
      doc.text(ls[0], margin + matProbAxisW + matRowLabelW / 2, ry + 13, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(ls[1], margin + matProbAxisW + matRowLabelW / 2, ry + 24, { align: "center" });
      doc.setFont("helvetica", "bold");

      [1, 2, 3, 4, 5].forEach((s, colIdx) => {
        const cx = matX + colIdx * matCellW;
        const cls = classificarRisco(p, s);
        fillRgb(cls.cor);
        doc.rect(cx, ry, matCellW, matCellH, "F");
        rgb([255, 255, 255]); doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text(String(p * s), cx + matCellW / 2, ry + matCellH / 2 + 4, { align: "center" });
      });
    });

    // Legenda
    const legX = matX + matCellW * 5;
    fillRgb(PRIMARY); doc.rect(legX, y, matLegendW, matCellH, "F");
    rgb([255, 255, 255]); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.text("LEGENDA", legX + matLegendW / 2, y + 13, { align: "center" });
    doc.setFontSize(6.8); doc.setFont("helvetica", "normal");
    doc.text("NÍVEL DE RISCO", legX + matLegendW / 2, y + 24, { align: "center" });
    const legendaItens: Array<[Nivel5, string]> = [
      ["INTOLERÁVEL", NIVEL5_FAIXA.INTOLERÁVEL],
      ["SUBSTANCIAL", NIVEL5_FAIXA.SUBSTANCIAL],
      ["MODERADO",    NIVEL5_FAIXA.MODERADO],
      ["TOLERÁVEL",   NIVEL5_FAIXA.TOLERÁVEL],
      ["TRIVIAL",     NIVEL5_FAIXA.TRIVIAL],
    ];
    legendaItens.forEach((it, i) => {
      // Alinhar com as linhas da matriz (que começam em matY + matCellH, após linha de labels de severidade)
      const ly = matY + matCellH + i * matCellH;
      fillRgb(NIVEL5_FILL[it[0]]);
      doc.rect(legX, ly, matLegendW, matCellH, "F");
      rgb(NIVEL5_COR[it[0]]); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(it[0], legX + matLegendW / 2, ly + matCellH / 2 - 2, { align: "center", baseline: "middle" } as any);
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
      doc.text(it[1], legX + matLegendW / 2, ly + matCellH / 2 + 9, { align: "center", baseline: "middle" } as any);
    });

    y = matY + matCellH * 6 + 24;

    // ---- Tabelas Probabilidade / Severidade / Controle ----
    subTitle("Escala de Probabilidade");
    autoTable(doc, {
      startY: y,
      head: [["Probabilidade", "Interpretação"]],
      body: [
        ["1", "Ambiente saudável"],
        ["2", "Boa condição"],
        ["3", "Atenção"],
        ["4", "Problema frequente"],
        ["5", "Problema crítico"],
      ],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9, halign: "center" },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { halign: "center", fontStyle: "bold", cellWidth: 90 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 14;

    subTitle("Escala de Severidade (impacto à saúde ocupacional)");
    autoTable(doc, {
      startY: y,
      head: [["Severidade", "Impacto"]],
      body: [
        ["1", "desconforto leve"],
        ["2", "fadiga mental leve"],
        ["3", "estresse ocupacional"],
        ["4", "transtornos psicológicos"],
        ["5", "adoecimento grave"],
      ],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9, halign: "center" },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { halign: "center", fontStyle: "bold", cellWidth: 90 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 14;

    // Manter o bloco "Métodos de Controle e Ação" sempre na mesma página
    if (y + 200 > pageH - 60) { doc.addPage(); y = margin + 30; }
    subTitle("Métodos de Controle e Ação");
    autoTable(doc, {
      startY: y,
      head: [["Nível de Risco", "Controle"]],
      body: [
        ["INTOLERÁVEL", "ações imediatas"],
        ["SUBSTANCIAL", "controle necessário"],
        ["MODERADO",    "controle adicional"],
        ["TOLERÁVEL",   "monitoramento"],
        ["TRIVIAL",     "nenhuma ação"],
      ],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 } },
      rowPageBreak: "avoid",
      pageBreak: "avoid",
      didParseCell: (h) => {
        if (h.section === "body" && h.column.index === 0) {
          const niveis: Nivel5[] = ["INTOLERÁVEL", "SUBSTANCIAL", "MODERADO", "TOLERÁVEL", "TRIVIAL"];
          const lvl = niveis[h.row.index];
          h.cell.styles.fillColor = NIVEL5_FILL[lvl];
          h.cell.styles.textColor = NIVEL5_COR[lvl];
        }
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 18;

    // ============== 10. INVENTÁRIO DE RISCOS OCUPACIONAIS PARA O PGR ==============
    // Renderizado em página própria em PAISAGEM — título, intro e tabela
    // ficam SEMPRE na mesma página. Não emitimos título na página retrato
    // anterior para evitar página quase-vazia (apenas título).

    const invBody: any[] = [];
    // Quebra explícita antes de "validar em campo" para nunca cortar a palavra.
    const CONTROLE_PADRAO = "Controle não evidenciado no momento da avaliação —\nvalidar em campo.";
    const cleanFuncNomeInv = (nome: string) => nome.replace(/[,;\s]+$/g, "").trim();
    const dedupFuncoesInv = (fs: typeof data.setores[number]["funcoes"]) => {
      const seen = new Set<string>();
      const out: string[] = [];
      fs.forEach((f) => {
        const k = cleanFuncNomeInv(f.funcao);
        if (!k || seen.has(k)) return;
        seen.add(k);
        out.push(k);
      });
      return out;
    };

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
        // Uma função por linha → autoTable nunca precisa quebrar dentro da palavra.
        const funcoesTxt = dedupFuncoesInv(s.funcoes).map((f) => protectWords(f)).join("\n") || "—";
        const controleTxt = textoControleParaLinha(s.setor, fp.dim.id);
        invBody.push([
          formatLabelGes(s.label),
          funcoesTxt,
          protectWords(fp.dim.title),
          protectWords(mte.agente),
          protectWords(mte.perigo),
          protectWords(mte.consequencia),
          protectWords(controleTxt),
          String(fp.prob),
          String(fp.sev),
          fp.risco.nivel5,
        ]);
      });
    }

    // Linhas consolidadas — APENAS quando não há dados por GES / Setores no recorte.
    if (data.setores.length === 0) {
      fatoresValidos.forEach((f) => {
        const mte = mteParaDim(f.dim.id, f.risco.nivel);
        invBody.push([
          protectWords(data.empresaNome),
          "—",
          protectWords(f.dim.title),
          protectWords(mte.agente),
          protectWords(mte.perigo),
          protectWords(mte.consequencia),
          protectWords(CONTROLE_PADRAO),
          String(f.prob),
          String(f.sev),
          f.risco.nivel5,
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
    rgb(PRIMARY); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("INVENTÁRIO DE RISCOS OCUPACIONAIS PARA O PGR", margin + 48, 55);
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]); doc.setLineWidth(0.6);
    doc.line(margin, 68, lwPageW - margin, 68);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const introLines = doc.splitTextToSize(
      "Resultado técnico final da AEP para integração direta ao Inventário de Riscos do PGR. Cada linha representa um risco psicossocial reconhecido no recorte avaliado, com a nomenclatura do Guia MTE.",
      lwPageW - margin * 2,
    );
    doc.text(introLines, margin, 84);
    const invStartY = 84 + introLines.length * 11 + 8;

    autoTable(doc, {
      startY: invStartY,
      head: [["GES / Setores", "Função", "Domínio", "Agente / Situação", "Perigo", "Possível Consequência", "Controles", "P", "S", "Nível de\nrisco PGR"]],
      body: invBody.length ? invBody : [["—", "—", "—", "—", "—", "—", "—", "—", "—", "—"]],
      headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 7.5, halign: "center", valign: "middle", cellPadding: 3 },
      styles: { fontSize: 7.5, cellPadding: 3, valign: "top", overflow: "linebreak" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // Soma ≈ 760pt — cabe na A4 paisagem (842 - 80 de margens = 762).
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 108 },
        1: { cellWidth: 93 },
        2: { cellWidth: 83 },
        3: { cellWidth: 98 },
        4: { cellWidth: 88, fontStyle: "bold" },
        5: { cellWidth: 98 },
        6: { cellWidth: 93, halign: "left" },
        7: { halign: "center", cellWidth: 14 },
        8: { halign: "center", cellWidth: 14 },
        9: { halign: "center", cellWidth: 70, fontStyle: "bold" },
      },
      didParseCell: (h: any) => { colorirNivel(9)(h); },
      margin: { left: margin, right: margin },
    });

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

    // ============== CARACTERIZAÇÃO DA EXPOSIÇÃO ==============
    // Exigida pelo Guia de Fatores de Riscos Psicossociais (MTE), no capítulo
    // sobre implementação: "Na caracterização da exposição deve-se fazer uma
    // descrição relatando como a atividade é realizada. Devem ser incluídos
    // aspectos importantes como a duração do trabalho, a frequência e a
    // intensidade da exposição".
    //
    // Os três eixos são derivados de P e S — a mesma escala que classifica o
    // risco —, o que os torna coerentes com o Inventário, mas os mantém como
    // LEITURA DO INSTRUMENTO. O Guia atribui a caracterização ao profissional,
    // que avalia "a partir das condições encontradas e do seu conhecimento e
    // expertise"; por isso a tabela sai marcada como preliminar, para ser
    // confirmada em campo pelo responsável técnico.
    const carBody: any[] = [];
    if (data.setores.length > 0) {
      data.setores.forEach((s) => {
        const fp = s.fatorPrincipal;
        if (!fp || fp.n === 0) return;
        const c = caracterizarExposicao(fp);
        carBody.push([
          formatLabelGes(s.label),
          protectWords(fp.dim.title),
          c.duracao,
          c.frequencia,
          c.intensidade,
          c.grupo,
        ]);
      });
    } else {
      fatoresValidos.forEach((f) => {
        const c = caracterizarExposicao(f);
        carBody.push([
          protectWords(data.empresaNome),
          protectWords(f.dim.title),
          c.duracao,
          c.frequencia,
          c.intensidade,
          c.grupo,
        ]);
      });
    }

    if (carBody.length > 0) {
      doc.addPage("a4", "portrait");
      y = 60;
      sectionTitle("Caracterização da Exposição");
      paragraph(
        "Descrição da exposição aos fatores de risco psicossociais identificados, considerando duração, " +
          "frequência e intensidade, conforme orienta o Guia de Fatores de Riscos Psicossociais do MTE. " +
          "Os valores abaixo derivam da probabilidade e da severidade apuradas no instrumento aplicado e " +
          "constituem caracterização PRELIMINAR: nos termos da NR-17 (subitem 17.3.1.1), a avaliação pode " +
          "ser qualitativa e cabe ao responsável técnico confirmá-la a partir das condições encontradas na " +
          "atividade real de trabalho.",
      );
      autoTable(doc, {
        startY: y,
        head: [["GES / Setores", "Domínio", "Duração", "Frequência", "Intensidade", "Grupo exposto"]],
        body: carBody,
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center", valign: "middle", cellPadding: 3 },
        styles: { fontSize: 7.5, cellPadding: 3, valign: "top", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 95 },
          1: { cellWidth: 85 },
          2: { cellWidth: 68, halign: "center" },
          3: { cellWidth: 78, halign: "center" },
          4: { cellWidth: 60, halign: "center" },
          5: { halign: "center" },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // Próxima seção só ganha página nova SE existir (evita página em branco).
    if (incluirPlanoAcao) {
      doc.addPage("a4", "portrait");
      y = 60;
    }




    // ============== 11. PLANO DE AÇÃO ==============
    if (incluirPlanoAcao) {
      sectionTitle("Plano de Ação Recomendado");
      paragraph(
        "Plano consolidado a partir do Inventário de Riscos Ocupacionais para o PGR. A prioridade " +
        "e o prazo seguem o Nível de Risco PGR (Probabilidade × Severidade), e não a classificação " +
        "psicossocial do COPSOQBR — esta última serve apenas como apoio interpretativo (observação). " +
        "Para atender à NR-01 (item 1.5.5), cada ação deve ter, na devolutiva técnica da empresa: " +
        "responsável formal, forma de acompanhamento, evidência esperada, data prevista e status atualizado. " +
        "Enquanto esses campos não estiverem pactuados, o Plano possui caráter técnico-preliminar."
      );


      const ordem: NivelRisco[] = ["Crítico", "Alto", "Médio", "Baixo"];
      const planoBody: any[] = [];
      let item = 0;
      const respDefault = "A definir pela empresa na devolutiva técnica";
      ordem.forEach((nivel) => {
        // Prioridade e prazo seguem o Nível de Risco PGR do Inventário
        data.setores.forEach((s) => {
          const fp = s.fatorPrincipal;
          if (!fp || fp.n === 0) return;
          const nivelPgr: NivelRisco = fp.risco.nivel;
          if (nivelPgr !== nivel) return;
          const mte = mteParaDim(fp.dim.id, nivelPgr);
          const acoes = getRecomendacoes(fp.dim.id, fp.scorePct);
          const acaoBase = acoes.length ? acoes.slice(0, 2).map((a) => "• " + a.titulo).join("\n") : "Monitorar";
          item += 1;
          planoBody.push([
            String(item).padStart(2, "0"),
            acaoBase,

            mte.perigo,
            formatLabelGes(s.label),
            respDefault,
            NIVEL_PRAZO[nivelPgr],
            NIVEL_PRIORIDADE[nivelPgr],
            "A iniciar",
            "—",
          ]);
        });
        if (data.setores.length === 0) {
          fatoresValidos
            .filter((f) => f.risco.nivel === nivel)
            .forEach((f) => {
              const mte = mteParaDim(f.dim.id, f.risco.nivel);
              const acoes = getRecomendacoes(f.dim.id, f.scorePct);
              const acaoTxt = acoes.length ? acoes.slice(0, 2).map((a) => "• " + a.titulo).join("\n") : "Monitorar";
              item += 1;
              planoBody.push([
                String(item).padStart(2, "0"),
                acaoTxt,
                mte.perigo,
                data.empresaNome,
                respDefault,
                NIVEL_PRAZO[nivel],
                NIVEL_PRIORIDADE[nivel],
                "A iniciar",
                "—",
              ]);
            });
        }
      });

      autoTable(doc, {
        startY: y,
        head: [["Item", "Ação", "Perigo relacionado", "GES / Setores", "Responsável", "Prazo", "Prioridade", "Status", "Evid."]],
        body: planoBody.length ? planoBody : [["—", "Sem ações no recorte", "—", "—", "—", "—", "—", "—", "—"]],
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 7.5, halign: "center" },
        styles: { fontSize: 7.5, cellPadding: 3.5, valign: "top", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { halign: "center", cellWidth: 22, fontStyle: "bold" },
          1: { cellWidth: 100 },
          2: { cellWidth: 66, fontStyle: "bold" },
          3: { cellWidth: 90 },
          4: { cellWidth: 70 },
          5: { cellWidth: 52, halign: "center" },
          6: { cellWidth: 48, halign: "center", fontStyle: "bold" },
          7: { cellWidth: 38, halign: "center" },
          8: { cellWidth: 24, halign: "center" },
        },
        rowPageBreak: "avoid",
        didParseCell: colorirNivel(6, true),
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      paragraph(
        "Observação: a classificação psicossocial do COPSOQBR foi utilizada apenas como apoio " +
        "interpretativo, sem alterar a prioridade formal do Plano de Ação, que segue o Nível de " +
        "Risco PGR do Inventário."
      );
      y += 8;
    }

    // ============== 12. CONCLUSÃO TÉCNICA ==============
    sectionTitle("Conclusão Técnica");
    const nivelGeral: NivelRisco =
      data.contagemNiveis.Crítico > 0 ? "Crítico" :
      data.contagemNiveis.Alto > 0 ? "Alto" :
      data.contagemNiveis.Médio > 0 ? "Médio" : "Baixo";

    paragraph(
      "A AEP identificou e classificou os perigos psicossociais relacionados ao trabalho conforme " +
      "metodologia técnica integrada à NR-01 (GRO/PGR) e NR-17 (Ergonomia), com nomenclatura " +
      "alinhada ao Guia de Fatores de Riscos Psicossociais do MTE."
    );

    const totalCad = data.gesCadastrados.length;
    const totalAva = data.gesAvaliados.length;
    const totalSem = data.gesSemAvaliacao.length;

    if (opts.contextoReavaliacao) {
      const setores = opts.contextoReavaliacao.setoresEscopo;
      const setoresTxt = setores.length > 1
        ? `${setores.slice(0, -1).join(", ")} e ${setores[setores.length - 1]}`
        : (setores[0] ?? "GES selecionados");
      callout(
        `A empresa ${data.empresaNome} teve ${data.totalRespostas} respostas válidas nesta Reavaliação Setorial Complementar, ` +
        `distribuídas nos GES selecionados: ${setoresTxt}. A presente AEP representa exclusivamente o recorte da ` +
        `reavaliação setorial, não substituindo a avaliação geral anterior da empresa.`,
        NIVEL_COR[nivelGeral],
      );
      paragraph(
        "Os achados devem ser interpretados apenas para os setores/GES reavaliados, considerando o período, a amostra e o escopo complementar da nova coleta."
      );
    } else if (somenteAvaliados) {
      callout(
        `A empresa ${data.empresaNome} teve ${data.totalRespostas} respostas válidas distribuídas em ${totalAva} GES avaliados neste ciclo. ` +
        `A presente AEP representa o recorte dos GES participantes da avaliação, com integração dos resultados ao Inventário de Riscos do PGR e ao Plano de Ação recomendado.`,
        NIVEL_COR[nivelGeral],
      );
      paragraph(
        "A avaliação deve ser revista em mudanças significativas ou no ciclo anual do PGR, conforme NR-01."
      );
    } else {
      callout(
        `A empresa ${data.empresaNome} possui ${totalCad} GES cadastrados. ` +
        `Nesta avaliação foram obtidas ${data.totalRespostas} respostas válidas em ${totalAva} GES avaliados. ` +
        (totalSem > 0
          ? `Os ${totalSem} GES sem respostas foram mantidos no relatório como cadastrados, ` +
            `porém não compõem o cálculo de risco psicossocial deste ciclo.`
          : `Todos os GES cadastrados foram avaliados neste ciclo.`),
        NIVEL_COR[nivelGeral],
      );
      paragraph(
        "Os achados foram integrados ao Inventário de Riscos do PGR e ao Plano de Ação recomendado. " +
        "Os GES sem respostas neste ciclo devem ser priorizados na próxima aplicação ou ter a ausência " +
        "de participantes formalmente justificada. A avaliação deve ser revista em mudanças significativas " +
        "ou no ciclo anual do PGR, conforme NR-01."
      );
    }

    // Notas de conformidade adicionais (participação e caráter preliminar)
    paragraph(
      "Participação dos trabalhadores / CIPA na análise: a lógica participativa do GRO/PGR pressupõe " +
      "envolvimento da CIPA (ou representantes dos trabalhadores) na análise dos resultados, na " +
      "priorização das ações e no acompanhamento das medidas de controle. A empresa deve registrar " +
      "formalmente essa participação na devolutiva técnica."
    );
    paragraph(
      "O presente relatório possui caráter técnico-preliminar quando houver controles, responsáveis " +
      "ou evidências pendentes de validação pela empresa em campo. A consolidação final integra-se ao " +
      "Inventário de Riscos e ao Plano de Ação do PGR após a devolutiva técnica."
    );


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
      ensure(150);
      y += 24;
      doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.5);
      const lineY = y + 30;
      doc.line(margin + 60, lineY, pageW - margin - 60, lineY);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); rgb(PRIMARY);
      doc.text(nome || "Responsável Técnico", pageW / 2, lineY + 14, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); rgb([60, 60, 60]);
      const linha2 = [form, reg].filter(Boolean).join(" — ") || "Formação / Registro Profissional";
      doc.text(linha2, pageW / 2, lineY + 28, { align: "center" });
      if (cargo) doc.text(cargo, pageW / 2, lineY + 42, { align: "center" });
      doc.text(`Data de emissão: ${dataE}`, pageW / 2, lineY + 56, { align: "center" });
      y = lineY + 70;
    }



    // ============== 13. ANEXOS ==============
    if (incluirAnexos) {
      sectionTitle("Anexos");

      subTitle("Anexo I — Mapeamento técnico COPSOQBR - Guia MTE");
      paragraph(
        "Tabela de conversão obrigatória utilizada pelo sistema. O sistema NÃO inventa perigos nem " +
        "agravos: o campo 'Possível consequência' segue exclusivamente o Guia de Fatores de Riscos " +
        "Psicossociais do MTE."
      );
      autoTable(doc, {
        startY: y,
        head: [["Domínio COPSOQBR", "Agente / Situação", "Perigo (fator de risco)", "Possível consequência (Guia MTE)"]],
        body: MTE_MAPA.map((m) => [m.dominio, m.agente, m.perigo, m.consequencia]),
        headStyles: { fillColor: ACCENT, textColor: 255, fontSize: 8, halign: "center" },
        styles: { fontSize: 8, cellPadding: 4, valign: "top" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 110 },
          1: { cellWidth: 140 },
          2: { fontStyle: "bold", cellWidth: 130 },
          3: { cellWidth: 95 },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 18;

      subTitle("Anexo II — Base normativa");
      bullets([
        "NR-01 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais (GRO/PGR).",
        "NR-17 — Ergonomia.",
        "Guia de Fatores de Riscos Psicossociais Relacionados ao Trabalho — MTE.",
        "Lei nº 14.457/2022 — CIPA e prevenção do assédio.",
        "COPSOQ III — Copenhagen Psychosocial Questionnaire (versão brasileira).",
      ]);
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

    for (let p = 2; p <= pages; p++) {
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

    void classificarRisco;
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
