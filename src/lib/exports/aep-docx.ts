// AEP — gerador de Word (versão sintética, mesma estrutura do PDF)
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak,
} from "docx";
import { toast } from "sonner";
import { textoInterpretacao, alertaEspecial, PROB_LABEL, SEV_LABEL, assertAgrupamentoGesAplicado, type AepDataset, type NivelRisco } from "./aep-data";
import { getRecomendacoes } from "@/lib/recomendacoes";

const FILL: Record<NivelRisco, string> = { Baixo: "DCFCE7", Médio: "FEF08A", Alto: "FED7AA", Crítico: "FECACA" };
const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function P(text: string, opts: { bold?: boolean; size?: number; color?: string; heading?: any } = {}) {
  return new Paragraph({
    heading: opts.heading,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color })],
  });
}
function row(cells: { text: string; bold?: boolean; fill?: string; width: number }[]) {
  return new TableRow({
    children: cells.map((c) => new TableCell({
      borders: cellBorders,
      width: { size: c.width, type: WidthType.DXA },
      shading: c.fill ? { fill: c.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c.text, bold: c.bold, size: 18 })] })],
    })),
  });
}
function table(widths: number[], header: string[], rows: (string | { text: string; fill?: string })[][]) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      row(header.map((h, i) => ({ text: h, bold: true, fill: "1E40AF", width: widths[i] }))),
      ...rows.map((r) => row(r.map((c, i) => typeof c === "string"
        ? { text: c, width: widths[i] }
        : { text: c.text, fill: c.fill, width: widths[i] }))),
    ],
  });
}

export async function gerarRelatorioAEPdocx(data: AepDataset) {
  try {
    assertAgrupamentoGesAplicado(data);
    const sec1Children: any[] = [];
    sec1Children.push(P("RELATÓRIO TÉCNICO DE AVALIAÇÃO ERGONÔMICA PRELIMINAR — AEP", { heading: HeadingLevel.TITLE, bold: true }));
    sec1Children.push(P("Fatores de Riscos Psicossociais Relacionados ao Trabalho", { bold: true }));
    sec1Children.push(P("Integração com NR-01, GRO/PGR e Matriz de Risco Ocupacional"));
    sec1Children.push(P(""));
    sec1Children.push(P(`Empresa: ${data.empresaNome}`));
    sec1Children.push(P(`GES / Setores: ${data.setorFiltro}`));
    sec1Children.push(P(`Responsável técnico: ${data.responsavelTecnico}`));
    sec1Children.push(P(`Período: ${data.periodo.inicio ?? "—"} a ${data.periodo.fim ?? "—"}`));
    sec1Children.push(P(`Respostas: ${data.totalRespostas}${data.taxaParticipacao != null ? ` (${data.taxaParticipacao}% participação)` : ""}`));
    sec1Children.push(P(`Emitido em: ${data.emitidoEm}`));
    sec1Children.push(new Paragraph({ children: [new PageBreak()] }));

    // Identificação
    const e = data.empresa;
    sec1Children.push(P("1. Identificação da empresa", { heading: HeadingLevel.HEADING_1 }));
    sec1Children.push(table([3000, 6000], ["Campo", "Valor"], [
      ["Razão social", e?.razao_social ?? data.empresaNome],
      ["Nome fantasia", e?.nome ?? data.empresaNome],
      ["CNPJ", e?.cnpj ?? "—"],
      ["Endereço", [e?.endereco, e?.cidade, e?.estado].filter(Boolean).join(", ") || "—"],
      ["Telefone", e?.telefone ?? "—"],
      ["E-mail", e?.email ?? "—"],
      ["Responsável técnico", data.responsavelTecnico],
    ]));
    sec1Children.push(P(""));

    sec1Children.push(P("2. Objetivo da avaliação", { heading: HeadingLevel.HEADING_1 }));
    sec1Children.push(P("Apresentar os resultados da AEP dos fatores psicossociais, classificar os riscos pela matriz 5×5 e propor plano de ação para integração ao GRO/PGR conforme NR-01 e NR-17."));

    sec1Children.push(P("3. Critérios de Probabilidade e Severidade", { heading: HeadingLevel.HEADING_1 }));
    sec1Children.push(table([3000, 3000, 3000], ["% críticas", "Probabilidade", "Classificação"], [
      ["0–20%", "1", "Baixa"], ["21–40%", "2", "Moderada"], ["41–60%", "3", "Significativa"],
      ["61–80%", "4", "Alta"], ["81–100%", "5", "Muito alta"],
    ]));
    sec1Children.push(P(""));
    sec1Children.push(table([2000, 3000, 4000], ["Peso", "Severidade", "Aplicação"], [
      ["1", "Leve", "Desconforto leve"], ["2", "Baixa", "Fadiga mental ocasional"],
      ["3", "Moderada", "Estresse persistente"], ["4", "Alta", "Transtornos psicológicos"],
      ["5", "Crítica", "Dano grave / OBRIGATÓRIO p/ assédio, violência e discriminação"],
    ]));

    sec1Children.push(P("4. Resultados gerais por fator", { heading: HeadingLevel.HEADING_1 }));
    sec1Children.push(table([3500, 1300, 800, 800, 1000, 1600],
      ["Fator", "% Críticas", "P", "S", "Risco", "Nível"],
      data.fatoresGerais.map((f) => [
        f.dim.title, `${f.scorePct}%`, String(f.prob), String(f.sev),
        String(f.risco.valor), { text: f.risco.nivel, fill: FILL[f.risco.nivel] },
      ]),
    ));

    sec1Children.push(P("5. Resultados por GES", { heading: HeadingLevel.HEADING_1 }));
    sec1Children.push(table([3500, 1500, 1500, 1500, 1000],
      ["GES / Setores", "Respondentes", "Maior Risco", "Nível", "Ação"],
      data.setores.map((s) => [
        s.label, String(s.n), String(s.riscoMaior.valor),
        { text: s.riscoMaior.nivel, fill: FILL[s.riscoMaior.nivel] },
        s.riscoMaior.acao,
      ]),
    ));

    sec1Children.push(P("6. Inventário de riscos psicossociais (GRO)", { heading: HeadingLevel.HEADING_1 }));
    const inv: any[] = [];
    data.fatoresGerais.filter((f) => f.n > 0).forEach((f) => inv.push(["Geral", f.dim.title,
      `${f.prob} ${PROB_LABEL[f.prob]}`, `${f.sev} ${SEV_LABEL[f.sev]}`, String(f.risco.valor),
      { text: f.risco.nivel, fill: FILL[f.risco.nivel] }]));
    data.setores.forEach((s) => s.fatores.filter((f) => f.n > 0).forEach((f) => inv.push([s.label, f.dim.title,
      `${f.prob} ${PROB_LABEL[f.prob]}`, `${f.sev} ${SEV_LABEL[f.sev]}`, String(f.risco.valor),
      { text: f.risco.nivel, fill: FILL[f.risco.nivel] }])));
    sec1Children.push(table([2200, 2800, 1500, 1500, 800, 1200],
      ["GES / Setores", "Fator", "Probabilidade", "Severidade", "Risco", "Nível"],
      inv.length ? inv : [["—", "Sem dados", "—", "—", "—", "—"]],
    ));

    sec1Children.push(P("7. Interpretação técnica", { heading: HeadingLevel.HEADING_1 }));
    data.fatoresGerais.filter((f) => f.n > 0).forEach((f) => {
      sec1Children.push(P(`${f.dim.title} — ${f.scorePct}% • Risco ${f.risco.valor} (${f.risco.nivel})`, { bold: true }));
      sec1Children.push(P(textoInterpretacao(f.risco.nivel)));
      if (f.dim.id === "ofensivos" && (f.risco.nivel === "Alto" || f.risco.nivel === "Crítico")) {
        sec1Children.push(P(alertaEspecial("ASSÉDIO MORAL, SEXUAL, VIOLÊNCIA OU DISCRIMINAÇÃO"), { bold: true, color: "B91C1C" }));
      }
    });

    sec1Children.push(P("8. Plano de ação por prioridade", { heading: HeadingLevel.HEADING_1 }));
    const plano: any[] = [];
    (["Crítico", "Alto", "Médio", "Baixo"] as NivelRisco[]).forEach((nivel) => {
      const fontes = [
        ...data.fatoresGerais.filter((f) => f.n > 0).map((f) => ({ setor: "Geral", f })),
        ...data.setores.flatMap((s) => s.fatores.filter((f) => f.n > 0).map((f) => ({ setor: s.label, f }))),
      ].filter((x) => x.f.risco.nivel === nivel);
      fontes.forEach(({ setor, f }) => {
        const acoes = getRecomendacoes(f.dim.id, f.scorePct);
        if (!acoes.length) plano.push([{ text: nivel, fill: FILL[nivel] }, setor, f.dim.title, "Manter monitoramento.", "Longo prazo"]);
        else acoes.forEach((a) => plano.push([{ text: nivel, fill: FILL[nivel] }, setor, f.dim.title, `${a.titulo} — ${a.detalhe}`, a.prazo]));
      });
    });
    sec1Children.push(table([1300, 1800, 2000, 3500, 1400],
      ["Prioridade", "GES / Setores", "Fator", "Ação", "Prazo"],
      plano.length ? plano : [["—", "—", "—", "Sem ações.", "—"]],
    ));

    sec1Children.push(P("9. Conclusão técnica", { heading: HeadingLevel.HEADING_1 }));
    const nivelGeral: NivelRisco = data.contagemNiveis.Crítico > 0 ? "Crítico"
      : data.contagemNiveis.Alto > 0 ? "Alto"
      : data.contagemNiveis.Médio > 0 ? "Médio" : "Baixo";
    sec1Children.push(P(`Nível geral predominante: ${nivelGeral.toUpperCase()}.`, { bold: true }));
    sec1Children.push(P(textoInterpretacao(nivelGeral)));

    sec1Children.push(P(""));
    sec1Children.push(P("___________________________________________"));
    sec1Children.push(P(data.responsavelTecnico, { bold: true }));
    sec1Children.push(P("Responsável técnico — AEP / Riscos Psicossociais"));
    sec1Children.push(P(`Emitido em: ${data.emitidoEm}`));

    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        children: sec1Children,
      }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `AEP-${data.empresaNome.replace(/\W+/g, "-")}-${new Date().toISOString().slice(0, 10)}.docx`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Word AEP gerado com sucesso");
  } catch (err: any) {
    console.error(err);
    toast.error("Falha ao gerar Word: " + (err?.message ?? String(err)));
  }
}
