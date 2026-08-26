// Geração do Relatório PDF (NR-01 / GRO).
// Extraído de src/routes/admin.relatorio.tsx para reduzir o tamanho da rota.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { DIMENSIONS, dimensionRiskScore } from "@/lib/copsoq";
import { getRecomendacoes, type Severidade } from "@/lib/recomendacoes";
import type { Resposta } from "@/lib/storage";
import aepCoverUrl from "@/assets/aep-cover.png";

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
import {
  classifyRisco,
  probFromScorePct,
  DIM_META,
  SEVERIDADE_DIM,
  type ApuLinha,
  type LinhaSetor,
} from "@/lib/risco-matriz";

const sevLabel: Record<Severidade, string> = {
  baixo: "Baixo", moderado: "Moderado", alto: "Alto", critico: "Crítico",
};


// ============================================================
// PDF
// ============================================================
async function exportarRelatorioPDF({
  empresaNome, setor, totalRespostas, apuracaoGeral, apuracaoSetores, respostas,
}: {
  empresaNome: string;
  setor: string;
  totalRespostas: number;
  apuracaoGeral: ApuLinha[];
  apuracaoSetores: LinhaSetor[];
  respostas: Resposta[];
}) {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 36;
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();
    let y = margin;

    const ensureSpace = (need: number) => {
      if (y + need > pageH - 40) { doc.addPage(); y = margin; }
    };

    const toc: { title: string; page: number }[] = [];
    let sectionCounter = 0;
    // Cabeçalho de seção em estilo "círculo numerado + título" (modelo profissional)
    const sectionTitle = (t: string, registerToc = false) => {
      ensureSpace(56);
      sectionCounter += 1;
      if (registerToc) toc.push({ title: t, page: doc.getCurrentPageInfo().pageNumber });
      const cx = margin + 14;
      const cy = y + 14;
      // círculo
      doc.setFillColor(30, 64, 175);
      doc.circle(cx, cy, 12, "F");
      doc.setTextColor(255); doc.setFontSize(11);
      doc.text(String(sectionCounter), cx, cy + 4, { align: "center" });
      // título
      doc.setTextColor(15, 23, 42); doc.setFontSize(14);
      const titleLines = doc.splitTextToSize(t.toUpperCase(), pageW - margin * 2 - 36);
      doc.text(titleLines, margin + 36, cy + 4);
      // sublinha de acento
      const lh = (titleLines.length - 1) * 14;
      doc.setDrawColor(30, 64, 175); doc.setLineWidth(1.4);
      doc.line(margin + 36, cy + 14 + lh, margin + 80, cy + 14 + lh);
      doc.setLineWidth(0.2);
      doc.setTextColor(20);
      y += 36 + lh;
    };

    // Parágrafo justificado simples
    const paragraph = (text: string, size = 10, color: [number, number, number] = [40, 40, 40]) => {
      ensureSpace(20);
      doc.setFontSize(size); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, pageW - margin * 2);
      lines.forEach((ln: string) => {
        ensureSpace(size + 4);
        doc.text(ln, margin, y);
        y += size + 4;
      });
      doc.setTextColor(20);
      y += 6;
    };

    // Subtítulo (negrito, menor que sectionTitle)
    const subTitle = (t: string) => {
      ensureSpace(24);
      doc.setFontSize(11); doc.setTextColor(15, 23, 42);
      doc.text(t, margin, y);
      doc.setTextColor(20);
      y += 14;
    };

    // Logo vetorial (desenhado em jsPDF — sem dependência de asset)
    const drawLogo = (x: number, yy: number, scale = 1) => {
      const w = 44 * scale, h = 44 * scale;
      doc.setFillColor(30, 64, 175);
      doc.roundedRect(x, yy, w, h, 6 * scale, 6 * scale, "F");
      doc.setFillColor(255, 255, 255);
      // escudo simplificado
      doc.setFontSize(20 * scale);
      doc.setTextColor(255);
      doc.text("A", x + w / 2, yy + h / 2 + 7 * scale, { align: "center" });
      doc.setTextColor(20);
    };

    // ============== CAPA PREMIUM (imagem pronta) ==============
    try {
      const coverData = await urlToDataUrl(aepCoverUrl);
      doc.addImage(coverData, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
    } catch {
      doc.setFillColor(8, 26, 51);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(28);
      doc.text("RELATÓRIO TÉCNICO", margin, pageH / 2);
    }

    // ============== PÁGINA 2: RESUMO EXECUTIVO ==============
    doc.addPage(); y = margin;
    sectionTitle("Resumo Executivo", true);

    // ----- Bloco de identificação -----
    const idBoxY = y;
    const idBoxH = 110;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, idBoxY, pageW - margin * 2, idBoxH, 8, 8, "FD");

    const colW = (pageW - margin * 2) / 2;
    const labelColor: [number, number, number] = [110, 116, 130];
    const valueColor: [number, number, number] = [8, 26, 51];

    const idField = (label: string, value: string, cx: number, cy: number, maxW: number) => {
      doc.setFontSize(8); doc.setTextColor(...labelColor);
      doc.text(label, cx, cy);
      doc.setFontSize(11); doc.setTextColor(...valueColor);
      const lines = doc.splitTextToSize(value || "—", maxW);
      doc.text(lines.slice(0, 2), cx, cy + 14);
    };

    idField("EMPRESA", empresaNome, margin + 18, idBoxY + 22, colW - 36);
    idField("GES / SETORES", setor, margin + 18, idBoxY + 68, colW - 36);
    idField("RESPOSTAS", String(totalRespostas), margin + colW + 8, idBoxY + 22, colW - 36);
    idField("EMITIDO EM", new Date().toLocaleString("pt-BR"), margin + colW + 8, idBoxY + 68, colW - 36);

    y = idBoxY + idBoxH + 18;

    // ----- KPI cards executivos -----
    const totalDims = apuracaoGeral.filter((l) => l.n > 0).length;
    const criticos = apuracaoGeral.filter((l) => l.n > 0 && l.risco.label === "INTOLERÁVEL").length;
    const altos = apuracaoGeral.filter((l) => l.n > 0 && l.risco.label === "SUBSTANCIAL").length;
    const medios = apuracaoGeral.filter((l) => l.n > 0 && l.risco.label === "MODERADO").length;
    const setorCritico = [...apuracaoSetores]
      .map((s) => ({ nome: s.setor, max: Math.max(0, ...s.porDim.map((d) => d.score)) }))
      .sort((a, b) => b.max - a.max)[0];
    const riscoGeral = criticos > 0 ? "INTOLERÁVEL" : altos > 0 ? "SUBSTANCIAL" : medios > 0 ? "MODERADO" : "TOLERÁVEL";
    const riscoCor: [number, number, number] = riscoGeral === "INTOLERÁVEL" ? [220, 38, 38]
      : riscoGeral === "SUBSTANCIAL" ? [249, 115, 22]
      : riscoGeral === "MODERADO" ? [234, 179, 8] : [34, 197, 94];
    const substanciais = altos; // back-compat para referências abaixo
    const moderados = medios;
    void substanciais; void moderados;

    const kpis: { label: string; value: string; color: [number, number, number] }[] = [
      { label: "RISCO GERAL", value: riscoGeral, color: riscoCor },
      { label: "TOTAL DE RESPOSTAS", value: String(totalRespostas), color: [30, 64, 175] },
      { label: "DIMENSÕES AVALIADAS", value: String(totalDims), color: [30, 64, 175] },
      { label: "RISCOS CRÍTICOS", value: String(criticos), color: [220, 38, 38] },
      { label: "RISCOS SUBSTANCIAIS", value: String(substanciais), color: [249, 115, 22] },
      { label: "SETOR PRIORITÁRIO", value: setorCritico?.nome ?? "—", color: [8, 26, 51] },
    ];

    const kpiCols = 3;
    const kpiGap = 10;
    const kpiW = (pageW - margin * 2 - kpiGap * (kpiCols - 1)) / kpiCols;
    const kpiH = 70;
    kpis.forEach((k, i) => {
      const col = i % kpiCols;
      const row = Math.floor(i / kpiCols);
      const kx = margin + col * (kpiW + kpiGap);
      const ky = y + row * (kpiH + kpiGap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kx, ky, kpiW, kpiH, 6, 6, "FD");
      // barra de cor lateral
      doc.setFillColor(...k.color);
      doc.roundedRect(kx, ky, 4, kpiH, 2, 2, "F");
      doc.setFontSize(7.5); doc.setTextColor(...labelColor);
      doc.text(k.label, kx + 12, ky + 18);
      doc.setFontSize(14); doc.setTextColor(...k.color);
      const vLines = doc.splitTextToSize(k.value, kpiW - 20);
      doc.text(vLines.slice(0, 2), kx + 12, ky + 40);
    });
    y += Math.ceil(kpis.length / kpiCols) * (kpiH + kpiGap) + 8;

    doc.setFontSize(8); doc.setTextColor(110);
    const conf = doc.splitTextToSize(
      "Documento confidencial — uso interno • Conforme Portaria MTE nº 1.419/2024 (NR-01) e NR-17.",
      pageW - margin * 2,
    );
    doc.text(conf, margin, y);
    doc.setTextColor(20);

    // ============== PÁGINA 3: NR-17 / AEP ==============
    doc.addPage(); y = margin;
    sectionTitle("Fundamentação — NR-17 e a lógica progressiva (AEP)", true);

    doc.setFontSize(10); doc.setTextColor(40);
    const intro = doc.splitTextToSize(
      "A lógica da NR-17 é progressiva. Primeiro se faz a varredura por meio da Análise Ergonômica Preliminar (AEP) e, quando necessário, aprofunda-se com a Avaliação Ergonômica do Trabalho (AET). Pular essa sequência — algo que ainda acontece em muitas empresas — gera escopos difusos, documentação de baixa qualidade e medidas que não resolvem o problema real.",
      pageW - margin * 2,
    );
    doc.text(intro, margin, y); y += intro.length * 12 + 8;

    autoTable(doc, {
      startY: y,
      head: [["AEP — Análise Ergonômica Preliminar"]],
      body: [
        ["Etapa inicial, mais ampla"],
        ["Identifica perigos e avalia riscos"],
        ["Obrigatória para todas as empresas"],
        ["Pode ser realizada por diferentes abordagens (qualitativa, semi-quantitativa, quantitativa)"],
        ["Resultados integrados ao PGR"],
      ],
      headStyles: { fillColor: [30, 64, 175], halign: "left", fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 6 },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 14;

    doc.setFontSize(9); doc.setTextColor(110);
    const nota = doc.splitTextToSize(
      "Este relatório materializa a etapa de AEP para os fatores psicossociais, alimentando o inventário de riscos do PGR conforme exigido pela NR-01.",
      pageW - margin * 2,
    );
    doc.text(nota, margin, y); y += nota.length * 11 + 10;
    doc.setTextColor(20);

    // ===================== GRÁFICOS =====================
    const chartW = (pageW - margin * 2 - 16) / 2;
    const chartH = 180;
    ensureSpace(chartH + 40);

    // Distribuição de risco (contagem por nível) — barras verticais
    const riskBuckets: Record<string, number> = { "TRIVIAL": 0, "TOLERÁVEL": 0, "MODERADO": 0, "SUBSTANCIAL": 0, "INTOLERÁVEL": 0 };
    apuracaoGeral.forEach((l) => { if (l.n > 0) riskBuckets[l.risco.label] = (riskBuckets[l.risco.label] || 0) + 1; });
    const riskColors: Record<string, [number, number, number]> = {
      "TRIVIAL":     [134, 239, 172],
      "TOLERÁVEL":   [34, 197, 94],
      "MODERADO":    [234, 179, 8],
      "SUBSTANCIAL": [249, 115, 22],
      "INTOLERÁVEL": [220, 38, 38],
    };

    const drawTitle = (t: string, x: number, yy: number) => {
      doc.setFontSize(10); doc.setTextColor(30, 64, 175);
      doc.text(t, x, yy); doc.setTextColor(20);
    };

    // Box 1: Distribuição de risco (barras)
    const x1 = margin;
    drawTitle("Distribuição de risco (dimensões)", x1, y + 10);
    doc.setDrawColor(220); doc.rect(x1, y + 16, chartW, chartH - 16);
    const riskKeys = Object.keys(riskBuckets);
    const maxBar = Math.max(1, ...riskKeys.map((k) => riskBuckets[k]));
    const barAreaW = chartW - 30;
    const barAreaH = chartH - 50;
    const barW = barAreaW / riskKeys.length - 8;
    riskKeys.forEach((k, i) => {
      const v = riskBuckets[k];
      const h = (v / maxBar) * barAreaH;
      const bx = x1 + 20 + i * (barW + 8);
      const by = y + 16 + (barAreaH - h) + 8;
      const c = riskColors[k];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(bx, by, barW, h, "F");
      doc.setFontSize(7); doc.setTextColor(60);
      doc.text(String(v), bx + barW / 2, by - 3, { align: "center" });
      doc.text(k, bx + barW / 2, y + 16 + barAreaH + 22, { align: "center" });
    });

    // Box 2: Top dimensões por % risco (barras horizontais)
    const x2 = margin + chartW + 16;
    drawTitle("Top dimensões por % risco", x2, y + 10);
    doc.setDrawColor(220); doc.rect(x2, y + 16, chartW, chartH - 16);
    const top = [...apuracaoGeral].filter((l) => l.n > 0).sort((a, b) => b.score - a.score).slice(0, 6);
    const rowH = (chartH - 32) / Math.max(1, top.length);
    const labelW = 110;
    const trackX = x2 + labelW;
    const trackW = chartW - labelW - 34;
    top.forEach((l, i) => {
      const ry = y + 22 + i * rowH;
      doc.setFontSize(6.5); doc.setTextColor(60);
      // Permite até 2 linhas para o label sem truncar
      const lines = doc.splitTextToSize(l.dim.title, labelW - 8);
      const cap = lines.slice(0, 2);
      const startY = ry + rowH / 2 + 2 - (cap.length - 1) * 4;
      cap.forEach((ln: string, j: number) => doc.text(ln, x2 + 6, startY + j * 8));
      doc.setFillColor(240, 240, 240); doc.rect(trackX, ry + rowH / 2 - 4, trackW, 8, "F");
      const w = (l.score / 100) * trackW;
      const c = riskColors[l.risco.label] ?? [99, 102, 241];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(trackX, ry + rowH / 2 - 4, w, 8, "F");
      doc.setFontSize(7); doc.setTextColor(30);
      doc.text(`${l.score}%`, trackX + trackW + 4, ry + rowH / 2 + 2);
    });

    y += chartH + 14;

    // ===================== CLASSIFICAÇÃO E AVALIAÇÃO =====================
    doc.addPage(); y = margin;
    sectionTitle("Classificação e Avaliação dos Riscos Psicossociais", true);

    paragraph(
      "A identificação e avaliação dos fatores de risco psicossociais foi realizada por meio da Análise Ergonômica Preliminar (AEP), com base no instrumento COPSOQ (Copenhagen Psychosocial Questionnaire) e adaptada às exigências das Normas Regulamentadoras brasileiras, especialmente NR-01 (Gerenciamento de Riscos Ocupacionais — GRO) e NR-17 (Ergonomia).",
    );
    paragraph(
      "A ferramenta contempla a análise estruturada de domínios organizacionais relacionados ao ambiente de trabalho, como demandas, controle, apoio da gestão, suporte dos colegas, relacionamentos interpessoais, clareza de papel e gerenciamento de mudanças. Esses domínios permitem identificar fatores organizacionais que podem contribuir para o estresse ocupacional e o comprometimento da saúde mental e do bem-estar.",
    );
    paragraph(
      "Os resultados são apresentados em percentuais de percepção dos trabalhadores e convertidos em níveis de risco para integração ao Inventário de Riscos do PGR, conforme metodologia de análise qualitativa baseada na matriz 5×5 (Probabilidade × Severidade — AIHA / NR-01).",
    );

    // -------- Matriz 5x5 --------
    subTitle("Matriz de Riscos 5×5 — metodologia AIHA");
    type Risk5 = "TRIVIAL" | "TOLERAVEL" | "MODERADO" | "SUBSTANCIAL" | "INTOLERAVEL";
    const matrixCellLabels: { txt: string; risk: Risk5 }[][] = [];
    // probabilidade: linhas (5 = muito provável → 1 = rara) | severidade: colunas (1 leve → 5 extremo)
    for (let p = 5; p >= 1; p--) {
      const row: typeof matrixCellLabels[number] = [];
      for (let s = 1; s <= 5; s++) {
        const r = p * s;
        let risk: Risk5;
        if (r >= 16) risk = "INTOLERAVEL";
        else if (r >= 13) risk = "SUBSTANCIAL";
        else if (r >= 9) risk = "MODERADO";
        else if (r >= 4) risk = "TOLERAVEL";
        else risk = "TRIVIAL";
        row.push({ txt: String(r), risk });
      }
      matrixCellLabels.push(row);
    }
    const RISK_FILL: Record<Risk5, [number, number, number]> = {
      TRIVIAL:     [220, 252, 231],
      TOLERAVEL:   [187, 247, 208],
      MODERADO:    [254, 240, 138],
      SUBSTANCIAL: [254, 215, 170],
      INTOLERAVEL: [254, 202, 202],
    };
    const sevHead = ["LEVE\n1", "BAIXA\n2", "MODERADA\n3", "ALTA\n4", "CRÍTICA\n5"];
    const probLabel = ["MUITO ALTA\n5", "ALTA\n4", "SIGNIFICATIVA\n3", "MODERADA\n2", "BAIXA\n1"];

    autoTable(doc, {
      startY: y,
      head: [[{ content: "PROBABILIDADE \\ SEVERIDADE", styles: { halign: "center", fillColor: [30, 64, 175], textColor: 255 } }, ...sevHead.map((h) => ({ content: h, styles: { halign: "center", fillColor: [30, 64, 175], textColor: 255, fontSize: 8 } })), { content: "LEGENDA", styles: { halign: "center", fillColor: [30, 64, 175], textColor: 255 } }]] as any,
      body: matrixCellLabels.map((row, i) => {
        const legenda = ["INTOLERÁVEL\n16 – 25", "SUBSTANCIAL\n13 – 15", "MODERADO\n9 – 12", "TOLERÁVEL\n4 – 8", "TRIVIAL\n1 – 3"][i];
        const legendaKey = (["INTOLERAVEL", "SUBSTANCIAL", "MODERADO", "TOLERAVEL", "TRIVIAL"] as const)[i];
        return [
          { content: probLabel[i], styles: { halign: "center", fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 7 } },
          ...row.map((c) => ({
            content: c.txt,
            styles: { halign: "center", valign: "middle", fillColor: RISK_FILL[c.risk], fontStyle: "bold", fontSize: 9 },
          })),
          { content: legenda, styles: { halign: "center", fillColor: RISK_FILL[legendaKey], fontStyle: "bold", fontSize: 7 } },
        ];
      }) as any,
      styles: { cellPadding: 6, lineColor: [220, 220, 220], lineWidth: 0.5 },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 14;

    // -------- Probabilidade --------
    subTitle("Probabilidade");
    paragraph("A probabilidade representa a chance de o problema ocorrer ou estar presente no ambiente de trabalho.", 9, [90, 90, 90]);
    autoTable(doc, {
      startY: y,
      head: [["%", "Interpretação", "Probabilidade"]],
      body: [
        ["90–100%", "ambiente muito saudável", "1"],
        ["75–89%", "boa condição", "2"],
        ["50–74%", "atenção", "3"],
        ["40–49%", "problema frequente", "4"],
        ["<40%", "problema crítico", "5"],
      ],
      headStyles: { fillColor: [30, 64, 175], halign: "center" },
      styles: { fontSize: 9, cellPadding: 5, halign: "center" },
      columnStyles: { 1: { halign: "left" } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    // -------- Severidade --------
    subTitle("Severidade");
    paragraph("A severidade representa o impacto do risco na saúde do trabalhador caso ele ocorra.", 9, [90, 90, 90]);
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
      headStyles: { fillColor: [30, 64, 175], halign: "center" },
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: { 0: { halign: "center", cellWidth: 80 }, 1: { halign: "left" } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    // -------- Métodos de Controle --------
    subTitle("Métodos de Controle e Ação");
    paragraph(
      "Os métodos de controle devem ser definidos de acordo com o nível de risco identificado. A priorização das ações segue a hierarquia de criticidade da matriz de risco — riscos mais elevados exigem intervenções imediatas e rigorosas, enquanto riscos de menor criticidade demandam monitoramento ou ação adicional.",
      9, [90, 90, 90],
    );
    autoTable(doc, {
      startY: y,
      head: [["Nível de Risco (ordem de prioridade)", "Controle de Ações"]],
      body: [
        [{ content: "1º INTOLERÁVEL (16–25)", styles: { fillColor: RISK_FILL.INTOLERAVEL, fontStyle: "bold" } }, "Ação imediata ou interrupção da atividade"],
        [{ content: "2º SUBSTANCIAL (13–15)", styles: { fillColor: RISK_FILL.SUBSTANCIAL, fontStyle: "bold" } }, "Controle necessário com prazo definido"],
        [{ content: "3º MODERADO (9–12)", styles: { fillColor: RISK_FILL.MODERADO, fontStyle: "bold" } }, "Controle adicional, se viável"],
        [{ content: "4º TOLERÁVEL (4–8)", styles: { fillColor: RISK_FILL.TOLERAVEL, fontStyle: "bold" } }, "Monitoramento periódico"],
        [{ content: "5º TRIVIAL (1–3)", styles: { fillColor: RISK_FILL.TRIVIAL, fontStyle: "bold" } }, "Nenhuma ação necessária"],
      ] as any,
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 9, cellPadding: 6 },
      columnStyles: { 0: { cellWidth: 200 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 18;

    // ===================== FLUXO INTELIGENTE QUESTIONÁRIO → PGR =====================
    doc.addPage(); y = margin;
    sectionTitle("Fluxo Técnico — do questionário psicossocial ao Plano de Ação", true);

    paragraph(
      "O sistema converte automaticamente as percepções coletadas pelo questionário psicossocial em fatores de risco ocupacionais, integrando o resultado ao GRO/PGR conforme NR-01, NR-17 e Guia de Riscos Psicossociais do MTE. A lógica técnica segue a sequência abaixo:",
    );

    // Diagrama horizontal do fluxo
    const flowSteps = [
      "QUESTIONÁRIO PSICOSSOCIAL",
      "DOMÍNIO",
      "AGENTE / SITUAÇÃO",
      "PERIGO (FATOR DE RISCO)",
      "LESÃO / AGRAVO",
      "CLASSIFICAÇÃO",
      "PGR + PLANO DE AÇÃO",
    ];
    ensureSpace(56);
    {
      const gap = 6;
      const totalW = pageW - margin * 2;
      const stepW = (totalW - gap * (flowSteps.length - 1)) / flowSteps.length;
      const stepH = 34;
      flowSteps.forEach((s, i) => {
        const sx = margin + i * (stepW + gap);
        doc.setFillColor(30, 64, 175);
        doc.roundedRect(sx, y, stepW, stepH, 4, 4, "F");
        doc.setTextColor(255); doc.setFontSize(7.2);
        const lines = doc.splitTextToSize(s, stepW - 6);
        const startY = y + stepH / 2 + 2 - (lines.length - 1) * 4;
        lines.forEach((ln: string, j: number) => doc.text(ln, sx + stepW / 2, startY + j * 8, { align: "center" }));
        if (i < flowSteps.length - 1) {
          doc.setDrawColor(30, 64, 175); doc.setLineWidth(1);
          doc.line(sx + stepW, y + stepH / 2, sx + stepW + gap, y + stepH / 2);
        }
      });
      doc.setTextColor(20); doc.setLineWidth(0.2);
      y += stepH + 14;
    }

    // Aviso de escopo (não diagnóstico clínico)
    ensureSpace(46);
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(margin, y, pageW - margin * 2, 38, 6, 6, "FD");
    doc.setFontSize(8.5); doc.setTextColor(120, 53, 15);
    const aviso = doc.splitTextToSize(
      "IMPORTANTE: o questionário psicossocial NÃO constitui diagnóstico médico ou psicológico. Os resultados representam exposição ocupacional a fatores de risco psicossociais relacionados ao trabalho, com foco organizacional e preventivo, subsidiando o GRO/PGR (NR-01) e a AEP (NR-17).",
      pageW - margin * 2 - 16,
    );
    doc.text(aviso, margin + 8, y + 14);
    doc.setTextColor(20); doc.setDrawColor(220);
    y += 38 + 14;

    // Tabela de conversão automática (Domínio → Agente → Perigo → Consequência)
    subTitle("Conversão automática: Domínio → Agente → Perigo → Possível Consequência");

    const FLUXO_MAP: Record<string, { agentes: string; perigo: string; consequencia: string }> = {
      demandas: {
        agentes: "Sobrecarga; múltiplas tarefas; pressão por prazos; ritmo intenso; excesso de demandas",
        perigo: "Excesso de demandas no trabalho (sobrecarga)",
        consequencia: "Estresse ocupacional; fadiga mental; burnout; ansiedade; adoecimento mental",
      },
      organizacao: {
        agentes: "Baixa autonomia; pouco controle sobre o trabalho; ausência de previsibilidade; falta de pausas",
        perigo: "Baixo controle no trabalho / falta de autonomia",
        consequencia: "Ansiedade; sofrimento psíquico; desmotivação; transtornos mentais",
      },
      relacoes: {
        agentes: "Falta de apoio da chefia/colegas; liderança inadequada; ambiguidade de papel; ambiente hostil",
        perigo: "Falta de apoio social / más relações no local de trabalho",
        consequencia: "Sofrimento psíquico; conflitos interpessoais; adoecimento mental; afastamentos",
      },
      interface: {
        agentes: "Conflito trabalho-vida; jornadas prolongadas; sobrecarga fora do expediente",
        perigo: "Interface trabalho-vida desequilibrada",
        consequencia: "Insônia; fadiga mental; esgotamento; transtornos psicológicos",
      },
      saude: {
        agentes: "Sintomas frequentes de estresse, esgotamento e prejuízo do sono",
        perigo: "Exposição cumulativa a estressores ocupacionais",
        consequencia: "Burnout; depressão; doenças psicossomáticas; afastamento por adoecimento mental",
      },
      ofensivos: {
        agentes: "Humilhação; perseguição; ameaças; assédio moral, sexual ou violência",
        perigo: "Assédio de qualquer natureza no trabalho",
        consequencia: "Transtornos psicológicos graves; estresse pós-traumático; afastamento; sofrimento psíquico",
      },
    };

    autoTable(doc, {
      startY: y,
      head: [["DOMÍNIO AVALIADO", "%", "AGENTES / SITUAÇÕES", "PERIGO (FATOR DE RISCO)", "POSSÍVEL CONSEQUÊNCIA (LESÃO/AGRAVO)", "CLASS."]],
      body: apuracaoGeral
        .filter((l) => l.n > 0)
        .map((l) => {
          const map = FLUXO_MAP[l.dim.id] ?? { agentes: "—", perigo: "—", consequencia: "—" };
          return [l.dim.title, `${l.score}%`, map.agentes, map.perigo, map.consequencia, l.risco.label];
        }),
      headStyles: { fillColor: [30, 64, 175], fontSize: 7.5, halign: "center", valign: "middle" },
      styles: { fontSize: 8, cellPadding: 4, valign: "top" },
      columnStyles: {
        0: { cellWidth: 75, fontStyle: "bold" },
        1: { cellWidth: 28, halign: "center", fontStyle: "bold" },
        2: { cellWidth: 110 },
        3: { cellWidth: 95, fontStyle: "bold" },
        4: { cellWidth: 130 },
        5: { cellWidth: 50, halign: "center", fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 1) {
          const v = parseInt(String(d.cell.raw), 10);
          if (v >= 70) d.cell.styles.fillColor = [254, 202, 202];
          else if (v >= 50) d.cell.styles.fillColor = [254, 215, 170];
          else if (v >= 30) d.cell.styles.fillColor = [254, 240, 138];
          else d.cell.styles.fillColor = [187, 247, 208];
        }
        if (d.section === "body" && d.column.index === 5) {
          const v = String(d.cell.raw);
          if (v === "INTOLERÁVEL") d.cell.styles.fillColor = [254, 202, 202];
          else if (v === "SUBSTANCIAL") d.cell.styles.fillColor = [254, 215, 170];
          else if (v === "MODERADO") d.cell.styles.fillColor = [254, 240, 138];
          else if (v === "TOLERÁVEL") d.cell.styles.fillColor = [187, 247, 208];
          else if (v === "TRIVIAL") d.cell.styles.fillColor = [220, 252, 231];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    paragraph(
      "Cada perigo identificado é classificado pela matriz 5×5 (Probabilidade × Severidade) e incorporado ao Inventário de Riscos do PGR, com tratamento por hierarquia de controle e plano de ação com prazos definidos.",
      9, [90, 90, 90],
    );

    // ===================== APURAÇÃO =====================
    doc.addPage(); y = margin;
    sectionTitle("Inventário de Riscos Ocupacionais para o PGR", true);
    paragraph(
      "Os domínios avaliados foram incorporados ao Inventário de Riscos Ocupacionais, permitindo a identificação dos fatores psicossociais relevantes no ambiente de trabalho e subsidiando a elaboração do Plano de Ação do PGR. Os resultados refletem a percepção dos trabalhadores no momento da avaliação e devem ser monitorados periodicamente, conforme o ciclo de melhoria contínua do GRO.",
    );
    subTitle("Apuração dos Resultados");


    const head = [["DOMÍNIO", "%", "AGENTE NOCIVO", "POSSÍVEIS DANOS", "P", "S", "NÍVEL DE RISCO"]];
    const linhasToBody = (linhas: ApuLinha[]) =>
      linhas.map((l) => {
        const meta = DIM_META[l.dim.id] ?? { agente: l.dim.description, danos: "—" };
        return [l.dim.title, `${l.score}%`, meta.agente, meta.danos, String(l.prob), String(l.sev), l.risco.label];
      });

    const renderApu = (titulo: string, linhas: ApuLinha[]) => {
      ensureSpace(40);
      doc.setFontSize(11); doc.setTextColor(30, 64, 175);
      doc.text(titulo, margin, y); y += 4;
      doc.setTextColor(20);
      autoTable(doc, {
        startY: y + 4,
        head, body: linhasToBody(linhas),
        headStyles: { fillColor: [30, 64, 175], fontSize: 8, halign: "center" },
        styles: { fontSize: 8, cellPadding: 4, valign: "top" },
        columnStyles: {
          0: { cellWidth: 80 }, 1: { cellWidth: 32, halign: "center" },
          2: { cellWidth: 100 }, 3: { cellWidth: 130 },
          4: { cellWidth: 24, halign: "center" }, 5: { cellWidth: 24, halign: "center" },
          6: { cellWidth: 80, halign: "center", fontStyle: "bold" },
        },
        margin: { left: margin, right: margin },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 6) {
            const v = String(d.cell.raw);
            if (v === "INTOLERÁVEL") d.cell.styles.fillColor = [254, 202, 202];
            else if (v === "SUBSTANCIAL") d.cell.styles.fillColor = [254, 215, 170];
            else if (v === "MODERADO") d.cell.styles.fillColor = [254, 240, 138];
            else if (v === "TOLERÁVEL") d.cell.styles.fillColor = [187, 247, 208];
            else if (v === "TRIVIAL") d.cell.styles.fillColor = [220, 252, 231];
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 14;
    };

    renderApu("GERAL", apuracaoGeral);
    apuracaoSetores.forEach((s) => {
      const linhas: ApuLinha[] = DIMENSIONS.map((d) => {
        const score = s.porDim.find((x) => x.dimId === d.id)?.score ?? 0;
        const sev = SEVERIDADE_DIM[d.id] ?? 3;
        const prob = probFromScorePct(score);
        return { dim: d, score, prob, sev, risco: classifyRisco(prob, sev), n: s.n };
      });
      renderApu(`${s.setor}  (${s.n} resposta(s))`, linhas);
    });

    // ===================== 2. RESPOSTAS =====================
    doc.addPage(); y = margin;
    sectionTitle("Inventário de Respostas Individuais", true);
    if (respostas.length === 0) {
      doc.setFontSize(10); doc.setTextColor(110);
      doc.text("Sem respostas no recorte.", margin, y); y += 14;
      doc.setTextColor(20);
    } else {
      const respHead = [["Empresa", "Setor", "Cargo", ...DIMENSIONS.map((d) => d.title.split(" ")[0])]];
      const respBody = respostas.map((r) => [
        r.nomeEmpresa,
        r.setor || "—",
        r.cargo || "—",
        ...DIMENSIONS.map((d) => `${dimensionRiskScore(d, r.answers)}`),
      ]);
      autoTable(doc, {
        startY: y,
        head: respHead, body: respBody,
        headStyles: { fillColor: [30, 64, 175], fontSize: 7, halign: "center" },
        styles: { fontSize: 7, cellPadding: 3, valign: "middle" },
        margin: { left: margin, right: margin },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index >= 3) {
            const v = Number(d.cell.raw);
            if (v >= 70) d.cell.styles.fillColor = [254, 202, 202];
            else if (v >= 50) d.cell.styles.fillColor = [254, 215, 170];
            else if (v >= 30) d.cell.styles.fillColor = [254, 240, 138];
            else if (v > 0) d.cell.styles.fillColor = [187, 247, 208];
            d.cell.styles.halign = "center";
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 14;
    }

    // ===================== 3. PLANO DE AÇÕES =====================
    doc.addPage(); y = margin;
    sectionTitle("Plano de Ações e Controle dos Riscos", true);

    if (apuracaoSetores.length === 0) {
      doc.setFontSize(10); doc.setTextColor(110);
      doc.text("Sem respostas para gerar plano de ações.", margin, y); y += 14;
      doc.setTextColor(20);
    } else {
      apuracaoSetores.forEach((p) => {
        const dims = p.porDim.filter((d) => d.sev !== "baixo");
        ensureSpace(50);
        doc.setFontSize(11); doc.setTextColor(30, 64, 175);
        doc.text(`${p.setor}  (${p.n} resposta(s))`, margin, y); y += 14;
        doc.setTextColor(20);

        if (dims.length === 0) {
          doc.setFontSize(9); doc.setTextColor(110);
          doc.text("Nenhuma dimensão acima de \"Baixo\". Manter monitoramento periódico.", margin, y); y += 14;
          doc.setTextColor(20);
          return;
        }

        const planoBody: (string | number)[][] = [];
        dims.forEach((d) => {
          const acoes = getRecomendacoes(d.dimId, d.score);
          if (acoes.length === 0) {
            planoBody.push([d.dimTitle, `${d.score}%`, sevLabel[d.sev], "Manter monitoramento periódico", "—"]);
          } else {
            acoes.forEach((a, i) => {
              planoBody.push([
                i === 0 ? d.dimTitle : "",
                i === 0 ? `${d.score}%` : "",
                i === 0 ? sevLabel[d.sev] : "",
                `${a.titulo}\n${a.detalhe}`,
                a.prazo,
              ]);
            });
          }
        });

        autoTable(doc, {
          startY: y,
          head: [["Dimensão", "%", "Severidade", "Ação", "Prazo"]],
          body: planoBody,
          headStyles: { fillColor: [30, 64, 175], fontSize: 8, halign: "left" },
          styles: { fontSize: 8, cellPadding: 4, valign: "top" },
          columnStyles: {
            0: { cellWidth: 90, fontStyle: "bold" },
            1: { cellWidth: 32, halign: "center" },
            2: { cellWidth: 60, halign: "center" },
            3: { cellWidth: "auto" as any },
            4: { cellWidth: 70, halign: "center" },
          },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
      });
    }

    // ============== SUMÁRIO (inserido após a capa) ==============
    doc.insertPage(2);
    doc.setPage(2);
    // shift TOC page numbers (+1 porque inserimos uma página antes)
    const tocItems = toc.map((t) => ({ title: t.title, page: t.page + 1 }));

    // Cabeçalho do sumário
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 72, "F");
    doc.setTextColor(180, 200, 230); doc.setFontSize(8);
    doc.text("PSICOSAFETY", margin, 32);
    doc.setTextColor(255); doc.setFontSize(20);
    doc.text("Sumário", margin, 56);

    // Eyebrow
    let ty = 104;
    doc.setFontSize(8); doc.setTextColor(110);
    doc.text("CONTEÚDO DO RELATÓRIO", margin, ty);
    ty += 6;
    doc.setDrawColor(30, 64, 175); doc.setLineWidth(1.2);
    doc.line(margin, ty, margin + 40, ty);
    doc.setLineWidth(0.2);
    ty += 18;

    // Espaço útil para a lista (deixa folga para o rodapé)
    const listBottom = pageH - 60;
    const itemsCount = tocItems.length;
    // Espaçamento dinâmico entre 22 e 34 pt para preencher sem cortar
    const available = listBottom - ty;
    const rowHToc = Math.max(30, Math.min(40, Math.floor(available / Math.max(1, itemsCount))));
    const numColW = 28;
    const pageColW = 32;
    const titleX = margin + numColW;
    const pageRightX = pageW - margin;

    tocItems.forEach((it, idx) => {
      const baseY = ty + idx * rowHToc;
      const textY = baseY + rowHToc / 2 + 3;

      // badge numérico
      doc.setFillColor(30, 64, 175);
      doc.roundedRect(margin, baseY + rowHToc / 2 - 9, 22, 18, 3, 3, "F");
      doc.setTextColor(255); doc.setFontSize(9);
      doc.text(String(idx + 1).padStart(2, "0"), margin + 11, baseY + rowHToc / 2 + 3, { align: "center" });

      // título — quebra em até 2 linhas em vez de truncar com "..."
      doc.setTextColor(20); doc.setFontSize(10.5);
      const pageStr = String(it.page);
      const pageStrW = doc.getTextWidth(pageStr);
      const maxTitleW = pageRightX - pageColW - titleX - 16;
      const titleLines = doc.splitTextToSize(it.title, maxTitleW).slice(0, 2);
      const lineH = 11;
      const blockH = titleLines.length * lineH;
      const startY = baseY + rowHToc / 2 + 3 - (titleLines.length - 1) * (lineH / 2);
      titleLines.forEach((ln: string, j: number) => doc.text(ln, titleX, startY + j * lineH));
      const lastLine = titleLines[titleLines.length - 1];

      // pontilhado (alinhado à última linha)
      const labelW = doc.getTextWidth(lastLine);
      const dotsStartX = titleX + labelW + 6;
      const dotsEndX = pageRightX - pageStrW - 6;
      if (dotsEndX > dotsStartX + 4) {
        doc.setTextColor(200); doc.setFontSize(9);
        let dx = dotsStartX;
        while (dx < dotsEndX) { doc.text(".", dx, textY); dx += 4; }
      }

      // página
      doc.setTextColor(30, 64, 175); doc.setFontSize(10.5);
      doc.text(pageStr, pageRightX, textY, { align: "right" });
      doc.setTextColor(20);

      // link clicável cobrindo a linha inteira
      doc.link(margin, baseY, pageW - margin * 2, rowHToc, { pageNumber: it.page });

      // separador sutil
      if (idx < itemsCount - 1) {
        doc.setDrawColor(235);
        doc.line(titleX, baseY + rowHToc - 1, pageRightX, baseY + rowHToc - 1);
      }
    });

    // Nota de rodapé do sumário
    doc.setFontSize(8); doc.setTextColor(140);
    doc.text("Toque em qualquer item para navegar até a seção correspondente.", margin, pageH - 36);

    // bookmarks (outline) — navegação lateral no leitor PDF
    try {
      tocItems.forEach((it) => {
        // jsPDF outline.add(parent, title, options)
        (doc as any).outline.add(null, it.title, { pageNumber: it.page });
      });
    } catch { /* outline opcional */ }

    // Rodapé (capa e sumário não numerados)
    const pages = doc.getNumberOfPages();
    for (let i = 3; i <= pages; i++) {
      doc.setPage(i);
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      doc.setDrawColor(220);
      doc.line(margin, h - 28, w - margin, h - 28);
      doc.setFontSize(8); doc.setTextColor(140);
      doc.text(`PSICOSAFETY • ${empresaNome}`, margin, h - 14);
      doc.text(`Página ${i - 2} de ${pages - 2}`, w - margin, h - 14, { align: "right" });
    }
    doc.save(`avalianr01-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Relatório PDF gerado");
  } catch (err) {
    console.error("Erro ao gerar PDF", err);
    toast.error("Erro ao gerar PDF");
  }
}
export { exportarRelatorioPDF };
