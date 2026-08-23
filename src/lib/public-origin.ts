/**
 * Origem pública usada para montar os links do questionário (QR code, e-mail,
 * link copiado). Antes era o domínio fixo da Lovable; agora vem do ambiente.
 *
 * Ordem: VITE_PUBLIC_APP_ORIGIN -> origem do navegador -> localhost.
 * Sem a variável o app funciona igual, usando o domínio em que está servido —
 * defina-a quando os links precisarem apontar para outro domínio (por exemplo,
 * o admin roda em um host interno e o questionário é público).
 */
const configured = import.meta.env.VITE_PUBLIC_APP_ORIGIN as string | undefined;

export function getPublicOrigin(): string {
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:8080";
}

/** URL pública do questionário a partir do código da campanha. */
export function buildQuestionarioUrl(codigo: string, query?: string): string {
  return `${getPublicOrigin()}/q/${codigo}${query ? `?${query}` : ""}`;
}
