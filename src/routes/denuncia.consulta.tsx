import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CATEGORIA_LABEL, STATUS_LABEL, consultarPorProtocolo, type Denuncia } from "@/lib/denuncias";

export const Route = createFileRoute("/denuncia/consulta")({
  head: () => ({ meta: [{ title: "Acompanhar denúncia" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ p: typeof s.p === "string" ? s.p : "", t: typeof s.t === "string" ? s.t : "" }),
  component: ConsultaDenuncia,
});

const STATUS_COLOR: Record<string, string> = {
  recebida: "bg-primary/15 text-primary",
  em_analise: "bg-warning/20 text-warning-foreground",
  investigacao: "bg-accent text-accent-foreground",
  concluida: "bg-success/15 text-success",
  arquivada: "bg-muted text-muted-foreground",
};

function ConsultaDenuncia() {
  const { p, t } = Route.useSearch();
  const [protocolo, setProtocolo] = useState(p);
  const [token, setToken] = useState(t);
  const [d, setD] = useState<Denuncia | null>(null);
  const [busy, setBusy] = useState(false);

  const buscar = async (pr: string, tk: string) => {
    setBusy(true);
    try {
      const r = await consultarPorProtocolo(pr, tk);
      if (!r) toast.error("Protocolo ou token inválido");
      setD(r);
    } finally { setBusy(false); }
  };

  useEffect(() => { if (p && t) buscar(p, t); }, [p, t]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/denuncia" search={{ c: "" }}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
        </Button>

        <Card>
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold">Acompanhar denúncia</h1>
            <p className="text-sm text-muted-foreground mt-1">Informe o protocolo e o token recebidos no envio.</p>

            <form onSubmit={(e) => { e.preventDefault(); buscar(protocolo, token); }} className="grid sm:grid-cols-3 gap-3 mt-6">
              <div className="sm:col-span-1">
                <Label>Protocolo</Label>
                <Input value={protocolo} onChange={(e) => setProtocolo(e.target.value.toUpperCase())} placeholder="D-2026-XXXXXX" className="font-mono" />
              </div>
              <div className="sm:col-span-2">
                <Label>Token</Label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} className="font-mono text-xs" />
              </div>
              <Button type="submit" disabled={busy} className="sm:col-span-3"><Search className="h-4 w-4 mr-1" /> {busy ? "Consultando..." : "Consultar"}</Button>
            </form>

            {d && (
              <div className="mt-8 space-y-4 border-t pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Protocolo</div>
                    <div className="font-mono font-bold">{d.protocolo}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLOR[d.status]}`}>
                    {STATUS_LABEL[d.status]}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div><div className="text-xs text-muted-foreground">Categoria</div>{CATEGORIA_LABEL[d.categoria]}</div>
                  <div><div className="text-xs text-muted-foreground">Recebida em</div>{new Date(d.created_at).toLocaleString("pt-BR")}</div>
                  {d.setor && <div><div className="text-xs text-muted-foreground">Setor</div>{d.setor}</div>}
                  <div><div className="text-xs text-muted-foreground">Tipo</div>{d.anonima ? "Anônima" : "Identificada"}</div>
                </div>
                {d.parecer && (
                  <div className="rounded-lg bg-secondary/60 p-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Parecer</div>
                    <p className="text-sm whitespace-pre-wrap">{d.parecer}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
