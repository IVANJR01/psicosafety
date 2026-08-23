import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Empresa, Resposta } from "./storage";
import { aggregateDimensions, aggregateBySetor } from "./empresa-stats";

const SEV_COLOR: Record<string, [number, number, number]> = {
  baixo: [16, 185, 129],
  moderado: [59, 130, 246],
  alto: [245, 158, 11],
  critico: [239, 68, 68],
};

const SEV_LABEL: Record<string, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};

const RISCO_COLOR: Record<string, [number, number, number]> = {
  "TRIVIAL":     [134, 239, 172],
  "TOLERÁVEL":   [34, 197, 94],
  "MODERADO":    [234, 179, 8],
  "SUBSTANCIAL": [249, 115, 22],
  "INTOLERÁVEL": [220, 38, 38],
};

export function gerarPgrPdf(empresa: Empresa, respostas: Resposta[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString("pt-BR");

  // CAPA
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("PROGRAMA DE GERENCIAMENTO DE RISCOS — NR-01", 15, 20);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Inventário de Riscos Psicossociais", 15, 35);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Conforme Portaria MTE nº 1.419/2024 e NR-17", 15, 45);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(empresa.nome, 15, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Código da empresa: ${empresa.codigo}`, 15, 85);
  doc.text(`Data do relatório: ${today}`, 15, 91);
  doc.text(`Total de respondentes: ${respostas.length}`, 15, 97);

  doc.setFillColor(241, 245, 249);
  doc.rect(15, 110, pageW - 30, 40, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Metodologia", 20, 118);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const metod = doc.splitTextToSize(
    "Avaliação baseada no instrumento COPSOQ (Copenhagen Psychosocial Questionnaire), com classificação de risco pela matriz Probabilidade × Severidade da NR-01 (item 1.5.4). A probabilidade é derivada da frequência observada (0–100%) e a severidade é a gravidade intrínseca do agravo à saúde por dimensão psicossocial.",
    pageW - 40,
  );
  doc.text(metod, 20, 124);

  // RESUMO POR DIMENSÃO
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("1. Resumo por Dimensão Psicossocial", 15, 20);

  const aggs = aggregateDimensions(respostas);
  autoTable(doc, {
    startY: 26,
    head: [["Dimensão", "Score", "Severidade", "Prob.", "Sev.", "Risco (PxS)", "Classificação"]],
    body: aggs.map((a) => [
      a.dim.title,
      a.n > 0 ? `${a.score}%` : "—",
      a.n > 0 ? SEV_LABEL[a.severidade] : "—",
      a.n > 0 ? String(a.prob) : "—",
      String(a.sev),
      a.n > 0 ? String(a.risco.nivel) : "—",
      a.n > 0 ? a.risco.label : "Sem dados",
    ]),
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const c = RISCO_COLOR[String(data.cell.raw)];
        if (c) {
          data.cell.styles.fillColor = c;
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = "bold";
        }
      }
      if (data.section === "body" && data.column.index === 2) {
        const sev = aggs[data.row.index].severidade;
        const c = SEV_COLOR[sev];
        if (c && aggs[data.row.index].n > 0) {
          data.cell.styles.fillColor = c;
          data.cell.styles.textColor = 255;
        }
      }
    },
  });

  // POR SETOR
  const setores = aggregateBySetor(respostas);
  if (setores.length) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("2. Heatmap por GES / Setores", 15, 20);

    const dimTitles = aggs.map((a) => a.dim.title);
    autoTable(doc, {
      startY: 26,
      head: [["Setor", "n", ...dimTitles]],
      body: setores.map((s) => [
        s.setor,
        String(s.n),
        ...s.porDim.map((d) => `${d.score}%`),
      ]),
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 35, fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index >= 2) {
          const v = parseInt(String(data.cell.raw).replace("%", ""), 10);
          if (!Number.isNaN(v)) {
            const c: [number, number, number] = v >= 70 ? [239, 68, 68] : v >= 50 ? [245, 158, 11] : v >= 30 ? [59, 130, 246] : [16, 185, 129];
            data.cell.styles.fillColor = c;
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.halign = "center";
          }
        }
      },
    });
  }

  // PLANO DE AÇÃO
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("3. Plano de Ação (recomendado)", 15, 20);

  const acoes: string[][] = [];
  aggs.forEach((a) => {
    if (a.n === 0) return;
    let prazo = "Monitorar (até 1 ano)";
    if (a.risco.label === "INTOLERÁVEL") prazo = "Ação imediata (até 30 dias)";
    else if (a.risco.label === "SUBSTANCIAL") prazo = "Plano em até 90 dias";
    else if (a.risco.label === "MODERADO") prazo = "Plano em até 180 dias";
    acoes.push([a.dim.title, a.risco.label, prazo, "RH / SESMT"]);
  });

  autoTable(doc, {
    startY: 26,
    head: [["Dimensão", "Classificação", "Prazo", "Responsável"]],
    body: acoes,
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  // Rodapé em todas as páginas
  const total = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `${empresa.nome} — PGR Riscos Psicossociais — ${today}`,
      15,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Página ${i} de ${total}`,
      pageW - 15,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  doc.save(`PGR-Psicossocial-${empresa.codigo}-${today.replaceAll("/", "-")}.pdf`);
}
