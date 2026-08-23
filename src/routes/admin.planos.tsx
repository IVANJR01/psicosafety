import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/planos")({
  head: () => ({ meta: [{ title: "Planos & Stripe | PSICOSAFETY" }, { name: "robots", content: "noindex" }] }),
  component: PlanosPage,
});

function PlanosPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    const { data } = await supabase.from("plans" as any).select("*").order("tipo").order("preco_mensal");
    setPlans((data ?? []) as any[]);
    const map: Record<string, string> = {};
    (data ?? []).forEach((p: any) => { map[p.id] = p.stripe_price_id ?? ""; });
    setEdits(map);
  };
  useEffect(() => { reload(); }, []);

  const save = async (id: string) => {
    setBusy(id);
    const v = edits[id]?.trim() || null;
    const { error } = await supabase.from("plans" as any).update({ stripe_price_id: v }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Plano atualizado");
    setBusy(null);
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Planos & Stripe"
        description={<>Cole o <strong>Price ID</strong> do Stripe (ex.: <code>price_1Q…</code>) em cada plano para habilitar o checkout.</>}
      />
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Limites</TableHead>
                <TableHead>Stripe Price ID</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell><Badge variant="outline">{p.tipo}</Badge></TableCell>
                  <TableCell>R$ {Number(p.preco_mensal).toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.max_empresas} emp · {p.max_avaliacoes} aval</TableCell>
                  <TableCell>
                    <Input
                      value={edits[p.id] ?? ""}
                      onChange={(e) => setEdits((m) => ({ ...m, [p.id]: e.target.value }))}
                      placeholder="price_..."
                      className="font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => save(p.id)} disabled={busy === p.id}>
                      <Save className="h-4 w-4 mr-1" /> Salvar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6 text-sm space-y-2">
          <div className="font-semibold">Webhook do Stripe</div>
          <p className="text-muted-foreground">
            No Stripe → Developers → Webhooks → <em>Add endpoint</em>, configure a URL:
          </p>
          <code className="block bg-muted p-2 rounded text-xs break-all">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/public/stripe-webhook
          </code>
          <p className="text-muted-foreground">
            Eventos: <code>checkout.session.completed</code>, <code>customer.subscription.created</code>,{" "}
            <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code>.
            Depois copie o <strong>Signing secret</strong> e me envie para salvar como <code>STRIPE_WEBHOOK_SECRET</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
