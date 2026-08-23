/**
 * Adaptador para Vercel Functions.
 *
 * O `npm run build` gera dist/client (estáticos, servidos pela CDN da Vercel)
 * e dist/server/server.js (o SSR, que exporta { fetch }). Este arquivo liga o
 * SSR à Function: converte o handler web em handler Node, que é o formato que
 * a Vercel executa.
 *
 * O roteamento — estáticos primeiro, resto cai aqui — está no vercel.json.
 * Para rodar fora da Vercel (VPS, Docker), o caminho é server/node.mjs.
 */
import { toNodeHandler } from "srvx/node";

import ssr from "../dist/server/server.js";

export default toNodeHandler((request) => ssr.fetch(request, process.env, {}));
