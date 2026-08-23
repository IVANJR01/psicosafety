import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { atualizarStatus, CATEGORIA_LABEL, listarDenuncias, STATUS_LABEL, registrarAcessoDenuncia, listarAcessosDenuncia, type Denuncia, type DenunciaAcesso, type DenunciaStatus } from "@/lib/denuncias";
import { listEmpresas, type Empresa } from "@/lib/empresas";
import { toast } from "sonner";
import { Eye, Shield, Megaphone, Copy, ExternalLink, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/denuncias")({
  head: () => ({ meta: [{ title: "Denúncias" }, { name: "robots", content: "noindex" }] }),
  component: DenunciasAdmin,
});

const STATUS_COLOR: Record<DenunciaStatus, string> = {
  recebida: "bg-primary/15 text-primary",
  em_analise: "bg-warning/20 text-warning-foreground",
  investigacao: "bg-accent text-accent-foreground",
  concluida: "bg-success/15 text-success",
  arquivada: "bg-muted text-muted-foreground",
};

function DenunciasAdmin() {
  const [items, setItems] = useState<Denuncia[]>([]);
  const [filtro, setFiltro] = useState<string>("todas");
  const [open, setOpen] = useState<Denuncia | null>(null);
  const [status, setStatus] = useState<DenunciaStatus>("recebida");
  const [parecer, setParecer] = useState("");
  const [acessos, setAcessos] = useState<DenunciaAcesso[]>([]);
  const [codigoEmpresa, setCodigoEmpresa] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const reload = async () => setItems(await listarDenuncias());
  useEffect(() => { reload(); }, []);
  useEffect(() => { listEmpresas().then(setEmpresas).catch(() => setEmpresas([])); }, []);

  useEffect(() => {
    if (open) {
      setStatus(open.status);
      setParecer(open.parecer ?? "");
      // Registra acesso e carrega histórico (best-effort)
      registrarAcessoDenuncia(open.id).catch(() => {});
      listarAcessosDenuncia(open.id).then(setAcessos).catch(() => setAcessos([]));
    } else {
      setAcessos([]);
    }
  }, [open]);

  const filtradas = useMemo(() => filtro === "todas" ? items : items.filter((i) => i.status === filtro), [items, filtro]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: items.length };
    items.forEach((i) => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [items]);

  const salvar = async () => {
    if (!open) return;
    try {
      await atualizarStatus(open.id, status, parecer);
      toast.success("Denúncia atualizada");
      setOpen(null);
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const codigoQuery = codigoEmpresa.trim() ? `?c=${encodeURIComponent(codigoEmpresa.trim().toUpperCase())}` : "";
  const linkDenuncia = `${origin}/denuncia${codigoQuery}`;
  const linkAcompanhamento = `${origin}/denuncia/consulta`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(linkDenuncia)}`;

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt).then(() => toast.success(`${label} copiado`));
  };

  return (
    <div>
      <PageHeader
        title="Canal de Denúncia"
        description="Gestão das denúncias recebidas. Visível para admin e técnico."
      />

      {/* Painel: Gerar Link do Canal de Denúncia */}
      <Card className="border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Gerar Link do Canal de Denúncia</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Compartilhe o link ou QR Code para permitir acesso ao formulário público de denúncias.
          </p>

          <div className="rounded-lg border bg-secondary/40 p-3 mb-4">
            <Label htmlFor="codEmp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa (opcional)</Label>
            <p className="text-[11px] text-muted-foreground mb-2">Escolha uma empresa para gerar um link já vinculado — o denunciante não precisa digitar nada. Se deixar em branco, o link é genérico e o denunciante informa o nome da empresa.</p>
            <Select value={codigoEmpresa || "__free__"} onValueChange={(v) => setCodigoEmpresa(v === "__free__" ? "" : v)}>
              <SelectTrigger id="codEmp" className="max-w-md">
                <SelectValue placeholder="Link genérico (sem empresa)" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover max-h-72">
                <SelectItem value="__free__">Link genérico (denunciante digita o nome)</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.codigo} value={e.codigo}>{e.nome} — {e.codigo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start">
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Link público</div>
                <code className="block text-xs break-all font-mono text-foreground/90 mb-3">{linkDenuncia}</code>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(linkDenuncia, "Link")}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                  </Button>
                  <Button size="sm" asChild>
                    <a href={linkDenuncia} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir
                    </a>
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Link de acompanhamento</div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Compartilhe para que denunciantes possam consultar o status da denúncia usando o protocolo.
                </p>
                <code className="block text-xs break-all font-mono text-foreground/90 mb-3">{linkAcompanhamento}</code>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(linkAcompanhamento, "Link")}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={linkAcompanhamento} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 rounded-lg border bg-background p-4">
              <img src={qrUrl} alt="QR Code do Canal de Denúncia" className="h-40 w-40 rounded" />
              <Button size="sm" variant="outline" asChild>
                <a href={qrUrl} download="qr-canal-denuncia.png" target="_blank" rel="noreferrer">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Baixar QR Code
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-6">
        {[["todas","Todas"],["recebida","Recebidas"],["em_analise","Em análise"],["investigacao","Investigação"],["concluida","Concluídas"],["arquivada","Arquivadas"]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`rounded-xl border p-3 text-left transition-colors ${filtro === k ? "border-primary bg-primary/5" : "hover:bg-secondary/60"}`}>
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-2xl font-bold">{counts[k] ?? 0}</div>
          </button>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma denúncia.</TableCell></TableRow>
              )}
              {filtradas.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs font-bold">{d.protocolo}</TableCell>
                  <TableCell className="text-sm">{new Date(d.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-sm">{CATEGORIA_LABEL[d.categoria]}</TableCell>
                  <TableCell className="text-sm">{d.codigo_empresa ?? "—"}</TableCell>
                  <TableCell className="text-xs">{d.anonima ? "Anônima" : "Identificada"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(d)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono">{open?.protocolo}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Categoria</div>{CATEGORIA_LABEL[open.categoria]}</div>
                <div><div className="text-xs text-muted-foreground">Setor</div>{open.setor ?? "—"}</div>
                <div><div className="text-xs text-muted-foreground">Empresa</div>{open.codigo_empresa ?? "—"}</div>
              </div>
              {!open.anonima && (
                <div className="rounded-lg bg-secondary/60 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Denunciante</div>
                  <div>{open.nome_denunciante} — {open.contato_denunciante}</div>
                </div>
              )}
              <div>
                <Label className="text-xs uppercase">Descrição</Label>
                <div className="rounded-lg bg-muted p-4 text-sm whitespace-pre-wrap mt-1 max-h-64 overflow-y-auto">{open.descricao}</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as DenunciaStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Parecer / observações</Label>
                <Textarea value={parecer} onChange={(e) => setParecer(e.target.value)} rows={4} />
              </div>
              {acessos.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Histórico de acessos ({acessos.length})
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                    {acessos.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2 border-t pt-1 first:border-t-0 first:pt-0">
                        <span className="font-medium">{a.user_email ?? a.user_id?.slice(0, 8) ?? "—"}</span>
                        <span className="text-muted-foreground">{a.acao}</span>
                        <span className="text-muted-foreground tabular-nums">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
