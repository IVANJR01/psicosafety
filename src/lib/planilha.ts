// Leitura de planilha enviada pelo usuário (.xlsx ou .csv), devolvendo uma
// linha por objeto, com o cabeçalho como chave e "" nas células vazias — o
// mesmo formato que `XLSX.utils.sheet_to_json(ws, { defval: "" })` devolvia.
//
// Substitui o pacote `xlsx` (SheetJS). Ele tinha dois alertas altos sem
// correção no npm (Prototype Pollution e ReDoS): o SheetJS parou de publicar
// lá, e instalar do CDN deles faria o build da Vercel depender daquele host.
//
//   .xlsx -> read-excel-file (mantido, sem alertas, carregado só na hora)
//   .csv  -> parser abaixo, sem dependência
//   .xls  -> recusado com instrução. É o formato binário do Excel 97-2003;
//            nenhum leitor mantido e sem alertas o suporta.

export type LinhaPlanilha = Record<string, unknown>;

export async function lerPlanilha(file: File): Promise<LinhaPlanilha[]> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".xls")) {
    throw new Error(
      'Arquivo .xls (Excel 97-2003) não é aceito. No Excel, use "Salvar como" e escolha .xlsx ou .csv.',
    );
  }
  const linhas = nome.endsWith(".csv") ? lerCsv(await file.arrayBuffer()) : await lerXlsx(file);
  return paraObjetos(linhas);
}

async function lerXlsx(file: File): Promise<unknown[][]> {
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(file)) as unknown[][];
}

// Cabeçalho na primeira linha; demais viram objetos. Object.create(null): as
// chaves vêm do arquivo enviado, e um objeto sem protótipo não tem
// `__proto__` nem `constructor` para sobrescrever. Linhas totalmente vazias
// são ignoradas, como o sheet_to_json fazia.
function paraObjetos(linhas: unknown[][]): LinhaPlanilha[] {
  const [cab, ...dados] = linhas;
  if (!cab) return [];
  const chaves = cab.map((c) => String(c ?? "").trim());
  return dados
    .filter((l) => l.some((v) => v !== null && v !== undefined && String(v).trim() !== ""))
    .map((l) => {
      const o: LinhaPlanilha = Object.create(null);
      chaves.forEach((k, i) => {
        if (k) o[k] = l[i] ?? "";
      });
      return o;
    });
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

// Encoding: dois casos comuns, e o pacote antigo só acertava um.
//   - Excel em português, "CSV (separado por vírgulas)": Windows-1252, sem BOM.
//   - Google Sheets, LibreOffice e o modelo gerado por esta tela: UTF-8.
// O `xlsx` assumia 1252 quando não havia BOM, então um CSV UTF-8 sem BOM
// virava "ProduÃ§Ã£o". Aqui: tenta UTF-8 estrito (que falha em qualquer byte
// 1252 acentuado, porque eles não formam sequências UTF-8 válidas) e, se
// falhar, decodifica como Windows-1252.
function decodificar(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

// Separador: o que mais aparece na primeira linha, fora de aspas.
function detectarSeparador(texto: string): string {
  const conta: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let aspas = false;
  for (const ch of texto) {
    if (ch === '"') aspas = !aspas;
    else if (!aspas && (ch === "\n" || ch === "\r")) break;
    else if (!aspas && ch in conta) conta[ch]++;
  }
  const [melhor, vezes] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  return vezes > 0 ? melhor : ",";
}

// RFC 4180: campos entre aspas podem conter o separador, quebras de linha e
// aspas duplicadas ("") como escape.
export function lerCsv(buf: ArrayBuffer): string[][] {
  const texto = decodificar(buf);
  const sep = detectarSeparador(texto);
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}
