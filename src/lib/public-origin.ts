/**
 * Origem pública usada para montar os links do questionário (QR code, e-mail,
 * link copiado). Antes era o domínio fixo da Lovable; agora vem do ambiente.
 *
 * Ordem de resolução:
 *   1. VITE_PUBLIC_APP_ORIGIN — escolhida no build, tem a palavra final
 *   2. no navegador: a origem em que a página está servida
 *   3. no servidor: variáveis que o provedor injeta em execução
 *   4. em desenvolvimento: localhost
 *
 * Em produção, com nada disso resolvido, devolve string vazia DE PROPÓSITO: o
 * link sai relativo (/q/CODIGO) e o navegador o resolve para o domínio certo.
 *
 * Antes esse caso caía em "http://localhost:8080". Como o valor é usado em
 * trechos que o servidor renderiza — os <a href> das telas de Admin e o campo
 * que mostra o link —, o endereço de localhost ia para dentro do HTML enviado
 * ao cliente e ficava lá até o React hidratar. Quem copiasse antes disso levava
 * um link quebrado, sem nenhum aviso. Link relativo é incompleto; link para
 * localhost é errado.
 */
const configurado = import.meta.env.VITE_PUBLIC_APP_ORIGIN as string | undefined;

function semBarraFinal(origem: string): string {
  return origem.replace(/\/+$/, "");
}

/**
 * Origem obtida do ambiente do servidor.
 *
 * Vale por não depender de novo build: as variáveis `VITE_` são embutidas no
 * bundle durante a compilação, então cadastrá-las depois não muda nada. Estas
 * são lidas em execução, o que salva o deploy em que a `VITE_PUBLIC_APP_ORIGIN`
 * foi esquecida.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` vem antes de `VERCEL_URL` porque a segunda é
 * o endereço daquele deploy específico, não o domínio público do projeto.
 */
function origemDoServidor(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;

  const doAmbiente = process.env.PUBLIC_APP_ORIGIN;
  if (doAmbiente) return doAmbiente;

  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : undefined;
}

let jaAvisou = false;

/** Um aviso por processo: o problema é de configuração, não de requisição. */
function avisarOrigemIndefinida(): void {
  if (jaAvisou) return;
  jaAvisou = true;
  console.warn(
    "[public-origin] Origem pública não resolvida no servidor — os links do " +
      "questionário sairão relativos. Defina VITE_PUBLIC_APP_ORIGIN no build " +
      "ou PUBLIC_APP_ORIGIN no ambiente para gerar links absolutos.",
  );
}

export function getPublicOrigin(): string {
  if (configurado) return semBarraFinal(configurado);
  if (typeof window !== "undefined") return window.location.origin;

  const doServidor = origemDoServidor();
  if (doServidor) return semBarraFinal(doServidor);

  if (import.meta.env.DEV) return "http://localhost:8080";

  avisarOrigemIndefinida();
  return "";
}

/** URL pública do questionário a partir do código da campanha. */
export function buildQuestionarioUrl(codigo: string, query?: string): string {
  return `${getPublicOrigin()}/q/${codigo}${query ? `?${query}` : ""}`;
}
