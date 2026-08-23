import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldAlert, Lock, Search, Send, Sparkles, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CATEGORIA_LABEL, criarDenuncia, type DenunciaCategoria } from "@/lib/denuncias";

export const Route = createFileRoute("/denuncia")({
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : "" }),
  head: () => ({
    meta: [
      { title: "Canal de Denúncia" },
      { name: "description", content: "Canal seguro e confidencial para denúncias de assédio, violência e discriminação no trabalho. Anônimo, com protocolo de acompanhamento." },
    ],
  }),
  component: CanalDenuncia,
});

function CanalDenuncia() {
  const nav = useNavigate();
  const { c: codigoFromUrl } = Route.useSearch();
  const [categoria, setCategoria] = useState<DenunciaCategoria>("assedio_moral");
  const [descricao, setDescricao] = useState("");
  const [setor, setSetor] = useState("");
  const [codigo, setCodigo] = useState((codigoFromUrl || "").toUpperCase());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ protocolo: string; token: string } | null>(null);
  const codigoLocked = !!codigoFromUrl;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (descricao.trim().length < 10) return toast.error("Descreva a ocorrência com pelo menos 10 caracteres.");
    setBusy(true);
    try {
      const r = await criarDenuncia({
        categoria,
        descricao: descricao.trim(),
        setor: setor.trim() || undefined,
        codigoEmpresa: codigo.trim() || undefined,
        anonima: true,

      });
      setResult(r);
      toast.success("Denúncia registrada");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao registrar denúncia");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const url = `${window.location.origin}/denuncia/consulta?p=${result.protocolo}&t=${result.token}`;
    return (
      <div className="min-h-screen" style={{ background: "var(--gradient-soft)" }}>
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <Card className="border-success/30">
            <CardContent className="pt-8 text-center">
              <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-success/15 text-success mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Denúncia registrada</h1>
              <p className="text-muted-foreground mt-2">Guarde o protocolo abaixo para acompanhar o andamento.</p>

              <div className="mt-8 space-y-4 text-left">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Protocolo</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={result.protocolo} className="font-mono text-base font-bold" />
                    <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(result.protocolo); toast.success("Copiado"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Token de consulta</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={result.token} className="font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(result.token); toast.success("Copiado"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Link direto</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={url} className="font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3 justify-center">
                <Button onClick={() => nav({ to: "/denuncia/consulta", search: { p: result.protocolo, t: result.token } as any })}>
                  Acompanhar denúncia
                </Button>
                <Button variant="outline" asChild><Link to="/">Voltar</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden text-white py-16 md:py-20" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0" style={{ backgroundImage: "var(--gradient-mesh)" }} />
        <div className="container relative mx-auto px-4 max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-medium mb-4">
            <Lock className="h-3.5 w-3.5" /> Confidencial · LGPD · 100% Anônimo
          </span>
          <h1 className="text-3xl md:text-5xl font-bold">Canal de Denúncia Ético</h1>
          <p className="mt-4 text-white/80 text-lg">
            Relate situações de assédio, violência ou discriminação. Sua identidade é protegida.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="shadow-[var(--shadow-elegant)]">
          <CardContent className="pt-8">
            <form onSubmit={submit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cat">Categoria *</Label>
                  <Select value={categoria} onValueChange={(v) => setCategoria(v as DenunciaCategoria)}>
                    <SelectTrigger id="cat">
                      <SelectValue placeholder="Selecione a categoria">
                        {CATEGORIA_LABEL[categoria]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      {Object.entries(CATEGORIA_LABEL).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cod">Nome/código da empresa *</Label>
                  <Input id="cod" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={32} placeholder="Ex.: ACME LTDA" readOnly={codigoLocked} required className={codigoLocked ? "bg-muted font-mono" : ""} />
                </div>
              </div>

              <div>
                <Label htmlFor="set">Setor / área (opcional)</Label>
                <Input id="set" value={setor} onChange={(e) => setSetor(e.target.value)} maxLength={120} />
              </div>

              <div>
                <Label htmlFor="desc">Descreva a ocorrência *</Label>
                <Textarea id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={6} maxLength={5000}
                  placeholder="Descreva o que aconteceu, quando, onde e quem estava envolvido. Quanto mais detalhes, melhor a investigação." />
                <div className="text-xs text-muted-foreground text-right mt-1">{descricao.length}/5000</div>
              </div>

              <div className="rounded-xl border bg-secondary/40 p-4 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Denúncia 100% anônima</div>
                  <div className="text-xs text-muted-foreground">Nenhuma informação pessoal é registrada. O acompanhamento é feito pelo protocolo gerado ao final.</div>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }} disabled={busy}>
                <Send className="h-4 w-4 mr-1.5" /> {busy ? "Enviando..." : "Enviar denúncia"}
              </Button>

              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" /> Sua denúncia gera um protocolo único para acompanhamento.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
