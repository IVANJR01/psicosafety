/**
 * Servidor de produção em Node puro.
 *
 * O `vite build` gera dois pedaços: `dist/client` (assets estáticos) e
 * `dist/server/server.js` (o handler de SSR, que exporta { fetch }). Na Lovable
 * quem juntava os dois era a infraestrutura deles. Aqui esse papel é deste
 * arquivo: serve os estáticos e manda o resto para o SSR.
 *
 *   npm run build && npm start
 *
 * PORT e HOST controlam onde ele escuta (padrão 3000 / 0.0.0.0).
 */
import { createReadStream, statSync } from "node:fs";
import { join, normalize, extname } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { serve } from "srvx";

const root = fileURLToPath(new URL("..", import.meta.url));
const clientDir = join(root, "dist", "client");

const ssr = (await import(join(root, "dist", "server", "server.js"))).default;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".pdf": "application/pdf",
  ".map": "application/json; charset=utf-8",
};

/** Resolve o caminho dentro de dist/client, barrando path traversal. */
function resolveAsset(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = normalize(join(clientDir, decoded));
  if (!candidate.startsWith(clientDir)) return null;
  try {
    return statSync(candidate).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

function serveAsset(filePath, pathname) {
  const ext = extname(filePath).toLowerCase();
  const { size } = statSync(filePath);
  // Arquivos em /assets/ levam hash no nome, então podem ser cacheados para sempre.
  const cacheControl = pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  // Readable.toWeb, não o stream do Node cru: passar o Readable direto faz o
  // undici tentar fechar o corpo duas vezes e derruba o processo.
  return new Response(Readable.toWeb(createReadStream(filePath)), {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "content-length": String(size),
      "cache-control": cacheControl,
    },
  });
}

const server = serve({
  port: Number(process.env.PORT ?? 3000),
  hostname: process.env.HOST ?? "0.0.0.0",
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" || request.method === "HEAD") {
      const asset = resolveAsset(pathname);
      if (asset) return serveAsset(asset, pathname);
    }

    return ssr.fetch(request, process.env, {});
  },
});

await server.ready();
console.log(`PsicoSafety no ar em ${server.url}`);
