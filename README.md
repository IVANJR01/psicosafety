# PSICOSAFETY

Plataforma de gestão de riscos psicossociais conforme a NR-01 — avaliação
COPSOQ, matriz de risco P×S, inventário GRO, plano de ação e relatório PGR.

Este projeto **não depende mais da Lovable**. Roda com Node e npm em qualquer
máquina, servidor ou provedor de hospedagem.

---

## Rodando localmente

Você precisa de **Node.js 22 ou superior**.

```bash
npm install          # instala as dependências
cp .env.example .env # e preencha as chaves (veja abaixo)
npm run dev          # http://localhost:8080
```

Para rodar como em produção:

```bash
npm run build
npm start            # http://localhost:3000
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. O mínimo para o app subir são as
chaves do Supabase — todas estão no painel do Supabase em
**Project Settings › Data API**.

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | sim | endereço do projeto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | sim | chave pública, respeita RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | para operações admin | ignora RLS, **só no servidor** |
| `VITE_PUBLIC_APP_ORIGIN` | recomendada em produção | domínio base dos links do questionário |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | só com assinatura | cobrança via Stripe |

Tudo que começa com `VITE_` **é embutido no bundle do navegador** e fica
visível para qualquer visitante. Nunca coloque a `service_role` numa variável
`VITE_`.

`VITE_PUBLIC_APP_ORIGIN` é o domínio usado para montar os links do questionário
(QR code, link copiado, e-mail). Sem ela o app usa o domínio em que está sendo
servido, o que já funciona na maioria dos casos — defina-a quando o admin rodar
num host diferente do questionário público.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento com hot reload, porta 8080 |
| `npm run build` | build de produção em `dist/` |
| `npm start` | sobe o build de produção, porta 3000 (`PORT` e `HOST` mudam isso) |
| `npm run preview` | build + start em sequência |
| `npm run typecheck` | checagem de tipos do TypeScript |
| `npm run lint` | ESLint |
| `npm run format` | Prettier — reformata o projeto inteiro |

## Como o projeto está montado

- **TanStack Start** (React 19 + TanStack Router) com renderização no servidor
- **Vite 7** para build, **Tailwind CSS 4** e **shadcn/ui** na interface
- **Supabase** como banco, autenticação e storage
- Rotas por arquivo em `src/routes/` — `src/routeTree.gen.ts` é gerado, não edite
- Regras de negócio em `src/lib/`, geração de PDF/DOCX em `src/lib/exports/`
- Migrações SQL versionadas em `supabase/migrations/`

O `npm run build` gera duas partes: `dist/client` (assets estáticos) e
`dist/server` (o renderizador). Quem junta as duas e serve por HTTP é o
`server/node.mjs` — é ele que o `npm start` executa.

## Banco de dados

O esquema está em `supabase/migrations/`. Para aplicar num projeto Supabase
novo, com a [CLI do Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref SEU_PROJECT_ID
supabase db push
```

## Deploy

O app é um servidor Node comum. Funciona em qualquer lugar que rode Node 22:
VPS, Docker, Render, Railway, Fly.io, EC2.

```bash
npm ci
npm run build
npm start
```

Configure as variáveis de ambiente no painel do provedor (não suba o `.env`) e
aponte o processo para a porta em `PORT`. Atrás de um Nginx ou Caddy, faça
proxy reverso para essa porta.

**Cloudflare Workers** continua disponível como alternativa: o `wrangler.jsonc`
já está configurado e o build aceita `DEPLOY_TARGET=cloudflare npm run build`.
Nesse caminho é preciso instalar o `wrangler` e publicar com `wrangler deploy`.

## Observações

- O ESLint está configurado com o Prettier, mas o código herdado nunca foi
  formatado — são ~3.300 avisos de formatação. `npm run format` resolve todos
  de uma vez, ao custo de um diff grande. Nada disso afeta o funcionamento.
- `src/integrations/supabase/types.ts` é gerado a partir do esquema do banco.
  Para regerar: `supabase gen types typescript --linked > src/integrations/supabase/types.ts`.
