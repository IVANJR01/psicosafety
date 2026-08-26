import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles, LayoutDashboard, Building2, LogOut, Layers, Briefcase,
  Users, MessageSquareWarning, ChevronRight, FileBarChart2, Megaphone, Upload, GitCompare, History, ShieldCheck, Clock, Menu, CreditCard, BadgeDollarSign, ClipboardList,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { adminLogout, getCurrentUser } from "@/lib/storage";
import { getCurrentAccountInfo, type AccountUsage } from "@/lib/account";
import { getCurrentProfileStatus } from "@/lib/admin-clientes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoPsicosafety from "@/assets/psicosafety-logo.png";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const items = [
  // 1. PAINEL
  { to: "/admin", label: "Visão Geral", icon: LayoutDashboard, exact: true as boolean, group: "Painel" },

  // 2. AVALIAÇÕES
  { to: "/admin/campanhas", label: "Campanhas", icon: Megaphone, exact: false as boolean, group: "Avaliações" },
  { to: "/admin/questionario", label: "Questionário Psicossocial", icon: ClipboardList, exact: false as boolean, group: "Avaliações" },
  { to: "/admin/import-respostas", label: "Importar Respostas", icon: History, exact: false as boolean, group: "Avaliações" },
  { to: "/admin/comparativo", label: "Comparativo", icon: GitCompare, exact: false as boolean, group: "Avaliações" },

  // 3. CADASTROS
  { to: "/admin/empresas", label: "Empresas", icon: Building2, exact: false as boolean, group: "Cadastros" },
  { to: "/admin/setores", label: "Setores / GES", icon: Layers, exact: false as boolean, group: "Cadastros" },
  { to: "/admin/cargos", label: "Funções / Cargos", icon: Briefcase, exact: false as boolean, group: "Cadastros" },
  { to: "/admin/usuarios", label: "Usuários", icon: Users, exact: false as boolean, group: "Cadastros" },

  // 4. RELATÓRIOS
  { to: "/admin/relatorio", label: "Relatórios", icon: FileBarChart2, exact: false as boolean, group: "Relatórios" },
  { to: "/admin/medidas-controle", label: "Medidas de Controle", icon: ShieldCheck, exact: false as boolean, group: "Relatórios" },

  // 5. COMPLIANCE
  { to: "/admin/denuncias", label: "Canal de Denúncia", icon: MessageSquareWarning, exact: false as boolean, group: "Compliance" },

  // 6. ADMINISTRAÇÃO
  { to: "/admin/assinar", label: "Assinatura", icon: CreditCard, exact: false as boolean, group: "Administração" },
  { to: "/admin/planos", label: "Planos & Stripe", icon: BadgeDollarSign, exact: false as boolean, group: "Administração" },
  { to: "/admin/clientes", label: "Liberações", icon: ShieldCheck, exact: false as boolean, group: "Administração" },

  // 7. SISTEMA
  { to: "/admin/import", label: "Importar CSV", icon: Upload, exact: false as boolean, group: "Sistema" },
] as const;

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [account, setAccount] = useState<AccountUsage | null>(null);
  const [profileStatus, setProfileStatus] = useState<"pending" | "active" | null>(null);

  useEffect(() => {
    if (path === "/admin/login") { setChecking(false); return; }
    let mounted = true;
    const verify = async () => {
      const user = await getCurrentUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const info = await getCurrentAccountInfo();
      const status = await getCurrentProfileStatus();
      if (!mounted) return;
      if (!info) { navigate({ to: "/login" }); return; }
      setEmail(user.email ?? "");
      setAccount(info);
      setProfileStatus(status);
      setChecking(false);
    };
    verify();
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login" });
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, [path, navigate]);

  // Após retornar do Stripe Checkout (?checkout=success), aguarda o webhook
  // atualizar o profile e libera o usuário automaticamente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "success") return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      while (!cancelled && attempts < 15) {
        attempts++;
        const status = await getCurrentProfileStatus();
        if (status === "active") {
          setProfileStatus("active");
          toast.success("Assinatura confirmada! Acesso liberado.");
          url.searchParams.delete("checkout");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
          navigate({ to: "/admin" });
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) {
        toast.message("Pagamento recebido. Finalizando liberação…", {
          description: "Se demorar, recarregue a página em alguns segundos.",
        });
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [navigate]);

  if (path === "/admin/login") return <Outlet />;

  const logout = async () => {
    await adminLogout();
    navigate({ to: "/login" });
  };

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: "var(--gradient-hero)" }}>
        <div className="text-white/80 flex items-center gap-3">
          <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Verificando acesso...
        </div>
      </div>
    );
  }

  // Bloqueio: cadastros pendentes → oferece assinatura via Stripe (libera automaticamente após pagamento)
  if (profileStatus === "pending" && account?.accountType !== "admin" && path !== "/admin/assinar") {
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-secondary/40">
        <div className="max-w-md text-center space-y-4 bg-background p-8 rounded-xl border shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100">
            <Clock className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold">Ative sua conta</h1>
          <p className="text-sm text-muted-foreground">
            Escolha um plano e libere o acesso ao painel imediatamente após o pagamento.
          </p>
          <Button onClick={() => navigate({ to: "/admin/assinar" })} className="mt-2">
            <CreditCard className="h-4 w-4 mr-2" /> Ver planos e assinar
          </Button>
          <div><Button variant="ghost" size="sm" onClick={logout}>Sair</Button></div>
        </div>
      </div>
    );
  }

  // Group nav items
  // Filtra menu por tipo de conta — só admin vê Liberações; empresa direta não vê Empresas/Imports/Usuários
  const ADMIN_ONLY = ["/admin/clientes", "/admin/usuarios", "/admin/import", "/admin/import-respostas", "/admin/planos", "/admin/questionario"];
  const visibleItems = items.filter((it) => {
    if (account?.accountType !== "admin" && ADMIN_ONLY.includes(it.to)) return false;
    if (account?.accountType === "empresa_direta") {
      return !["/admin/empresas"].includes(it.to);
    }
    return true;
  });

  const grouped = visibleItems.reduce<Record<string, typeof items[number][]>>((acc, it) => {
    (acc[it.group] = acc[it.group] || []).push(it);
    return acc;
  }, {});

  const current = visibleItems.find((it) => (it.exact ? path === it.to : path.startsWith(it.to)));

  const initials = (email || "AA").slice(0, 2).toUpperCase();
  const tipoLabel = account?.accountType === "consultor" ? "Consultor"
    : account?.accountType === "empresa_direta" ? "Empresa" : "Administrador";

  return (
    <div className="min-h-screen flex relative" style={{ background: "var(--gradient-page)" }}>
      <div className="absolute inset-0 bg-grid-fade pointer-events-none" />
      {/* Sidebar */}
      <aside
        className="hidden md:flex w-64 flex-col text-white relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute inset-0 opacity-60 pointer-events-none" style={{ background: "var(--gradient-mesh)" }} />
        <div className="relative z-10 flex flex-col h-full">
          <Link to="/" className="flex flex-col items-center gap-1 p-4 border-b border-white/10">
            <span className="grid place-items-center w-full rounded-xl bg-white shadow-lg px-3 py-2">
              <img src={logoPsicosafety} alt="PSICOSAFETY" className="h-12 w-auto object-contain" />
            </span>
            <div className="text-[10px] uppercase tracking-widest text-white/50 mt-1">{tipoLabel}</div>
          </Link>

          {account?.plan && (
            <div className="mx-3 mt-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-white/50">Plano atual</div>
              <div className="text-sm font-semibold text-white truncate">{account.plan.nome}</div>
              <div className="mt-2 space-y-1.5">
                {account.accountType !== "consultor" && (
                  <UsageBar label="Empresas" used={account.empresasUsadas} max={account.plan.max_empresas} />
                )}
                <UsageBar label="Avaliações" used={account.avaliacoesUsadas} max={account.plan.max_avaliacoes} />
              </div>
            </div>
          )}
          <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
            {Object.entries(grouped).map(([group, list]) => (
              <div key={group}>
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {list.map((it) => {
                    const active = it.exact ? path === it.to : path.startsWith(it.to);
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all relative ${
                          active
                            ? "nav-active-glow text-white"
                            : "text-white/65 hover:text-white hover:bg-white/8"
                        }`}
                      >
                        {active && (
                          <span
                            className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full"
                            style={{ background: "var(--gradient-primary)", boxShadow: "0 0 12px oklch(0.62 0.2 245 / 0.8)" }}
                          />
                        )}
                        <it.icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${active ? "text-white" : "text-white/50 group-hover:text-white/90"}`} />
                        <span className="flex-1 font-medium tracking-tight">{it.label}</span>
                        {active && <ChevronRight className="h-3.5 w-3.5 opacity-80" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5">
              <div
                className="h-9 w-9 rounded-full grid place-items-center text-xs font-bold"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{email || "Usuário"}</div>
                <div className="text-[10px] text-white/50">{tipoLabel}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={logout}
                className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <header className="hidden md:flex h-16 border-b border-border/60 bg-background/60 backdrop-blur-xl sticky top-0 z-20 items-center px-6 gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <span>Painel</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground font-medium truncate">{current?.label ?? "—"}</span>
          </div>
          <div className="flex-1" />
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Sistema operacional
            </span>
            <span className="hidden xl:inline truncate max-w-[220px]" title={email}>{email}</span>
          </div>
        </header>

        {/* Mobile header */}
        <header className="md:hidden h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px] text-white border-0" style={{ background: "var(--gradient-hero)" }}>
                <div className="absolute inset-0 opacity-60 pointer-events-none" style={{ background: "var(--gradient-mesh)" }} />
                <div className="relative z-10 flex flex-col h-full">
                  <SheetHeader className="p-4 border-b border-white/10">
                    <SheetTitle className="text-white flex items-center gap-2">
                      <img src={logoPsicosafety} alt="PSICOSAFETY" className="h-8 w-8 object-contain bg-white rounded-md p-1" />
                      PSICOSAFETY
                    </SheetTitle>
                    <div className="text-[10px] uppercase tracking-widest text-white/50 text-left">{tipoLabel}</div>
                  </SheetHeader>
                  <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
                    {Object.entries(grouped).map(([group, list]) => (
                      <div key={group}>
                        <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                          {group}
                        </div>
                        <div className="space-y-0.5">
                          {list.map((it) => {
                            const active = it.exact ? path === it.to : path.startsWith(it.to);
                            return (
                              <Link
                                key={it.to}
                                to={it.to}
                                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                  active
                                    ? "bg-white/15 text-white shadow-sm"
                                    : "text-white/70 hover:text-white hover:bg-white/8"
                                }`}
                              >
                                <it.icon className="h-4 w-4" />
                                <span className="flex-1">{it.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </nav>
                  <div className="p-3 border-t border-white/10">
                    <Button variant="ghost" onClick={logout} className="w-full justify-start text-white/80 hover:text-white hover:bg-white/10">
                      <LogOut className="h-4 w-4 mr-2" /> Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/admin" className="font-semibold flex items-center gap-2">
              <img src={logoPsicosafety} alt="PSICOSAFETY" className="h-8 w-8 object-contain" />
              <span className="text-sm">{current?.label ?? "PSICOSAFETY"}</span>
            </Link>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const danger = pct >= 90;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-white/70">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{used}/{max}</span>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-0.5">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: danger ? "var(--destructive)" : "var(--gradient-primary)" }}
        />
      </div>
    </div>
  );
}
