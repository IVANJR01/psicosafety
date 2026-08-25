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
| `VITE_PUBLIC_APP_ORIGIN` ou `PUBLIC_APP_ORIGIN` | em produção, sim | domínio base dos links do questionário |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | só com assinatura | cobrança via Stripe |

Tudo que começa com `VITE_` **é embutido no bundle do navegador** e fica
visível para qualquer visitante. Nunca coloque a `service_role` numa variável
`VITE_`.

### O domínio dos links do questionário

É o endereço usado para montar o link que vai para o QR code, para o campo de
copiar e para o e-mail. A origem é resolvida nesta ordem:

1. `VITE_PUBLIC_APP_ORIGIN` — escolhida no build, tem a palavra final
2. no navegador, o domínio em que a página está servida
3. no servidor, `PUBLIC_APP_ORIGIN` ou as variáveis automáticas da Vercel
   (`VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`)
4. em desenvolvimento, `localhost`

Vale definir uma das duas. Sem nenhuma, o servidor não tem como saber o domínio
público: os links saem **relativos** (`/q/CODIGO`) e um aviso aparece no log do
servidor. Relativo funciona no navegador, mas não serve para colar num e-mail.

A diferença entre as duas: `VITE_PUBLIC_APP_ORIGIN` é embutida durante o build,
então mudá-la exige publicar de novo; `PUBLIC_APP_ORIGIN` é lida a cada
execução, o que permite corrigir o domínio sem rebuildar.

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

### Vercel

O `vercel.json` já está configurado — a Vercel serve `dist/client` pela CDN e
manda o resto para uma Function (`api/index.mjs`), que roda o SSR. Não é
preciso mexer em Build Command nem Output Directory ao importar o projeto.

Cadastre as variáveis de ambiente **antes do primeiro deploy**: as `VITE_*` são
embutidas no bundle durante o build, não lidas em tempo de execução. Se o build
rodar sem elas, adicionar depois não resolve — é preciso buildar de novo.

Cada push na branch `main` gera um novo deploy.

### Qualquer servidor Node

O app também é um servidor Node comum. Funciona em qualquer lugar que rode
Node 22: VPS, Docker, Render, Railway, Fly.io, EC2.

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
