import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, LayoutDashboard, FileText, ShieldCheck, FileDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminLogout, isEmpresaUser, getCurrentUser, getCurrentEmpresa, type Empresa } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/empresa")({
  head: () => ({ meta: [{ title: "Portal da Empresa | PsicoSafe" }, { name: "robots", content: "noindex" }] }),
  component: EmpresaLayout,
});

const items = [
  { to: "/empresa", label: "Dashboard", icon: LayoutDashboard, exact: true as boolean },
  { to: "/empresa/respostas", label: "Respostas", icon: FileText, exact: false as boolean },
  { to: "/empresa/classificacao", label: "Classificação", icon: ShieldCheck, exact: false as boolean },
  { to: "/empresa/pgr", label: "Relatório PGR", icon: FileDown, exact: false as boolean },
] as const;

function EmpresaLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    if (path === "/empresa/login") { setChecking(false); return; }
    let mounted = true;
    (async () => {
      const user = await getCurrentUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const ok = await isEmpresaUser();
      if (!mounted) return;
      if (!ok) { navigate({ to: "/login" }); return; }
      const emp = await getCurrentEmpresa();
      if (!mounted) return;
      if (!emp) {
        // Sem empresa vinculada — verificar account_type e status para enviar ao fluxo correto
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type, status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile?.account_type === "empresa_direta" && profile?.status !== "active") {
          navigate({ to: "/admin/assinar" });
          return;
        }
      }
      setEmpresa(emp);
      setChecking(false);
    })();
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login" });
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, [path, navigate]);

  if (path === "/empresa/login") return <Outlet />;

  const logout = async () => {
    await adminLogout();
    navigate({ to: "/login" });
  };

  if (checking) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Verificando acesso...</div>;
  }

  if (!empresa) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Conta sem empresa vinculada</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não está associada a nenhuma empresa. Aguarde a aprovação do administrador
            ou entre em contato com o suporte.
          </p>
          <Button variant="outline" onClick={logout}>Sair</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-secondary/30">
      <aside className="hidden md:flex w-60 flex-col border-r bg-background">
        <Link to="/" className="flex items-center gap-2 font-semibold p-4 border-b">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm truncate">{empresa.nome}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{empresa.codigo}</div>
          </div>
        </Link>
        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => {
            const active = it.exact ? path === it.to : path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t">
          <Button variant="ghost" className="w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 border-b bg-background flex items-center justify-between px-4">
          <Link to="/empresa" className="font-semibold truncate">{empresa.nome}</Link>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" /></Button>
        </header>
        <nav className="md:hidden flex border-b bg-background overflow-x-auto">
          {items.map((it) => {
            const active = it.exact ? path === it.to : path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`px-4 py-2 text-sm whitespace-nowrap ${
                  active ? "text-primary font-medium border-b-2 border-primary" : "text-muted-foreground"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
