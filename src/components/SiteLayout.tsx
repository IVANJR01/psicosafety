import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ShieldAlert, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import logoPsicosafety from "@/assets/psicosafety-logo.png";

const nav = [
  { to: "/", label: "Início" },
  { to: "/como-funciona", label: "Como funciona" },
  { to: "/fatores-de-risco", label: "Recursos" },
  { to: "/sobre-nr01", label: "NR-01" },
  { to: "/", label: "Planos", hash: "planos" },
] as const;

export function SiteLayout() {
  const [open, setOpen] = useState(false);
  const location = useRouterState({ select: (s) => s.location });
  const path = location.pathname;
  const hash = location.hash;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-14 md:h-16 items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center group shrink-0" aria-label="PSICOSAFETY">
            <img src={logoPsicosafety} alt="PSICOSAFETY — Gestão de Riscos Psicossociais" className="h-9 md:h-12 w-auto object-contain" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((n) => {
              const hasHash = "hash" in n;
              const active = hasHash ? path === n.to && hash === n.hash : n.to === "/" ? path === "/" && !hash : path.startsWith(n.to);
              return (
                <Link
                  key={`${n.to}-${n.label}`}
                  to={n.to}
                  hash={hasHash ? n.hash : undefined}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    active
                      ? "text-primary font-semibold bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            <Button asChild size="sm" variant="outline" className="ml-2 border-primary text-primary hover:bg-primary hover:text-white">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="shadow-[var(--shadow-glow)] text-white" style={{ background: "var(--gradient-primary)" }}>
              <a
                href="https://wa.me/5588996349359?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20um%20especialista%20PSICOSAFETY."
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar com especialista
              </a>
            </Button>
          </nav>

          <button
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="lg:hidden border-t bg-background">
            <div className="container mx-auto flex flex-col gap-1 px-5 py-3">
              {nav.map((n) => (
                <Link
                  key={`${n.to}-${n.label}`}
                  to={n.to}
                  hash={"hash" in n ? n.hash : undefined}
                  onClick={() => setOpen(false)}
                  className="px-3 py-3 text-base rounded-md hover:bg-secondary"
                >
                  {n.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-1 gap-2">
                <Button asChild variant="outline" className="w-full h-12 border-primary text-primary">
                  <Link to="/login" onClick={() => setOpen(false)}>Entrar na plataforma</Link>
                </Button>
                <Button asChild className="w-full h-12 text-white shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-primary)" }}>
                  <a
                    href="https://wa.me/5588996349359?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20um%20especialista%20PSICOSAFETY."
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    Falar com especialista
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-secondary/40 mt-10 md:mt-12">
        <div className="container mx-auto px-5 sm:px-6 py-8 md:py-12 grid gap-6 md:gap-8 grid-cols-2 md:grid-cols-4 text-sm">
          <div className="col-span-2 md:col-span-2">
            <div className="mb-2 md:mb-3">
              <img src={logoPsicosafety} alt="PSICOSAFETY" className="h-10 md:h-14 w-auto object-contain" />
            </div>
            <p className="text-muted-foreground max-w-md text-[13px] md:text-sm leading-[1.6]">
              Gestão inteligente de riscos psicossociais, PGR e conformidade com a NR-01 (Portaria MTE nº 1.419/2024).
            </p>
          </div>
          <div>
            <div className="font-semibold mb-2 text-[13px] md:text-sm">Plataforma</div>
            <ul className="space-y-1.5 text-muted-foreground text-[13px] md:text-sm">
              {nav.slice(0, 5).map((n) => (
                <li key={n.to}><Link to={n.to} className="hover:text-foreground">{n.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2 text-[13px] md:text-sm">Conformidade</div>
            <ul className="space-y-1.5 text-muted-foreground text-[13px] md:text-sm">
              <li className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> LGPD</li>
              <li>NR-01 / NR-17</li>
              <li>COPSOQ III</li>
              <li>PGR / GRO</li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="container mx-auto px-4 py-3 md:py-4 text-[11px] md:text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} PSICOSAFETY — Todos os direitos reservados
          </div>
        </div>
      </footer>
    </div>
  );
}
