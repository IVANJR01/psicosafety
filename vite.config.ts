import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Deploy para Cloudflare Workers é opcional: DEPLOY_TARGET=cloudflare npm run build.
// Sem essa variável o build gera dist/client + dist/server, servidos pelo
// servidor Node em server/node.mjs (npm start).
const isCloudflare = process.env.DEPLOY_TARGET === "cloudflare";

async function cloudflarePlugin(): Promise<PluginOption[]> {
  if (!isCloudflare) return [];
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return [cloudflare({ viteEnvironment: { name: "ssr" } })];
}

export default defineConfig(async ({ mode }) => {
  // O código de servidor (client.server.ts, auth-middleware.ts) lê process.env.
  // O Vite só expõe as VITE_* para o cliente, então em dev as variáveis do .env
  // precisam ser copiadas para process.env na mão — na Lovable quem fazia isso
  // era a plataforma.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    process.env[key] ??= value;
  }

  return {
    server: {
      // host: true = 0.0.0.0. O "::" que vinha do sandbox da Lovable quebra em
      // ambiente sem IPv6 (container, CI, algumas VPS).
      host: true,
      port: Number(process.env.PORT ?? 8080),
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      // Uma única cópia de React e do TanStack no bundle — duas cópias quebram
      // hooks e o contexto do router.
      dedupe: [
        "react",
        "react-dom",
        "@tanstack/react-router",
        "@tanstack/react-start",
        "@tanstack/react-query",
      ],
    },
    plugins: [
      ...(await cloudflarePlugin()),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tailwindcss(),
      tanstackStart({
        // src/server.ts embrulha o handler de SSR para transformar erro 500 cru
        // na página de erro da marca.
        server: { entry: "server" },
      }),
      viteReact(),
    ],
  };
});
