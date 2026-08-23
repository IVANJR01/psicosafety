import * as XLSX from "xlsx";
import { DIMENSIONS, dimensionRiskScore, riskLabel } from "./copsoq";
import type { Resposta } from "./storage";

export function exportRespostasXlsx(respostas: Resposta[], fileName = "respostas-copsoq.xlsx") {
  const headers = [
    "Data",
    "Empresa",
    "Código",
    "Setor",
    "Cargo",
    ...DIMENSIONS.map((d) => `${d.title} (%)`),
    ...DIMENSIONS.map((d) => `${d.title} — classificação`),
  ];
  const rows = respostas.map((r) => {
    const scores = DIMENSIONS.map((d) => dimensionRiskScore(d, r.answers));
    const labels = scores.map((s) => riskLabel(s).label);
    return [
      new Date(r.criadoEm).toLocaleString("pt-BR"),
      r.nomeEmpresa,
      r.codigoEmpresa,
      r.setor || "",
      r.cargo || "",
      ...scores,
      ...labels,
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, Math.min(28, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Respostas");
  XLSX.writeFile(wb, fileName);
}
