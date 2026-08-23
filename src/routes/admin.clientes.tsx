import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, Briefcase, Building2, Search, Users, BadgeDollarSign, AlertTriangle, ShieldOff } from "lucide-react";
import { listClientes, setClienteStatus, setClientePlan, type ClienteRow } from "@/lib/admin-clientes";
import { listPlans } from "@/lib/account";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Liberações de Clientes | PSICOSAFETY" }, { name: "robots", content: "noindex" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "pending" | "consultor" | "empresa_direta">("todos");
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    const [c, p] = await Promise.all([listClientes(), listPlans()]);
    setRows(c.filter((r) => r.account_type !== "admin"));
    setPlans(p);
  };
  useEffect(() => { reload(); }, []);

  const stats = useMemo(() => {
    const pendentes = rows.filter((r) => r.status === "pending").length;
    const consultores = rows.filter((r) => r.account_type === "consultor" && r.status === "active").length;
    const empresas = rows.filter((r) => r.account_type === "empresa_direta" && r.status === "active").length;
    const mrr = rows.filter((r) => r.status === "active").reduce((s, r) => s + (r.preco_mensal ?? 0), 0);
    return { pendentes, consultores, empresas, mrr };
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (filtro === "pending" && r.status !== "pending") return false;
    if (filtro === "consultor" && r.account_type !== "consultor") return false;
    if (filtro === "empresa_direta" && r.account_type !== "empresa_direta") return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (!r.email.toLowerCase().includes(q) && !(r.display_name ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const aprovar = async (r: ClienteRow) => {
    setBusy(r.user_id);
    try { await setClienteStatus(r.user_id, "active"); toast.success(`${r.email} liberado`); await reload(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const suspender = async (r: ClienteRow) => {
    if (!confirm(`Suspender acesso de ${r.email}?`)) return;
    setBusy(r.user_id);
    try { await setClienteStatus(r.user_id, "pending"); toast.success("Acesso suspenso"); await reload(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const trocarPlano = async (r: ClienteRow, planId: string) => {
    setBusy(r.user_id);
    try { await setClientePlan(r.user_id, planId); toast.success("Plano atualizado"); await reload(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader
        title="Liberações de Clientes"
        description="Aprove novos cadastros, ajuste planos e acompanhe o uso de cada cliente."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" />Aguardando liberação</div>
          <div className="text-2xl font-bold mt-1">{stats.pendentes}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Briefcase className="h-3.5 w-3.5 text-primary" />Consultores ativos</div>
          <div className="text-2xl font-bold mt-1">{stats.consultores}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5 text-primary" />Empresas diretas ativas</div>
          <div className="text-2xl font-bold mt-1">{stats.empresas}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><BadgeDollarSign className="h-3.5 w-3.5 text-emerald-600" />MRR estimado</div>
          <div className="text-2xl font-bold mt-1">R$ {stats.mrr.toFixed(2)}</div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <TabsList>
            <TabsTrigger value="todos">Todos ({rows.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({stats.pendentes})</TabsTrigger>
            <TabsTrigger value="consultor">Consultores</TabsTrigger>
            <TabsTrigger value="empresa_direta">Empresas diretas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[220px] max-w-sm ml-auto">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
        </div>
      </div>

      {/* Tabela */}
      <Card className="mt-4">
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum cliente nesse filtro.
                </TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const tipoPlanos = plans.filter((p) => p.tipo === r.account_type);
                const usoPct = r.max_empresas ? Math.round((r.empresas_usadas / r.max_empresas) * 100) : 0;
                const tipoLabel = r.account_type === "consultor" ? "Consultor" : "Empresa direta";
                const TipoIcon = r.account_type === "consultor" ? Briefcase : Building2;
                return (
                  <TableRow key={r.user_id}>
                    <TableCell>
                      <div className="font-medium">{r.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1"><TipoIcon className="h-3 w-3" />{tipoLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.plan_id ?? ""}
                        onValueChange={(v) => trocarPlano(r, v)}
                        disabled={busy === r.user_id || tipoPlanos.length === 0}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Sem plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {tipoPlanos.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome} — R$ {Number(p.preco_mensal).toFixed(0)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{r.empresas_usadas}/{r.max_empresas ?? "—"} empresas</div>
                      <div className="text-muted-foreground">{r.avaliacoes_usadas}/{r.max_avaliacoes ?? "—"} avaliações</div>
                      {usoPct >= 80 && <Badge variant="destructive" className="mt-1 text-[10px]">Limite {usoPct}%</Badge>}
                    </TableCell>
                    <TableCell>
                      {r.status === "active" ? (
                        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" />Ativo</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-amber-700 bg-amber-100"><Clock className="h-3 w-3" />Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <Button size="sm" onClick={() => aprovar(r)} disabled={busy === r.user_id}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Liberar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => suspender(r)} disabled={busy === r.user_id}>
                          <ShieldOff className="h-4 w-4 mr-1" /> Suspender
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Novos cadastros entram como <strong>Pendente</strong> e ficam bloqueados até serem liberados aqui.
      </p>
    </div>
  );
}
