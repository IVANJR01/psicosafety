import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, Building2, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminLogin, adminSignup, getCurrentUser, isAdmin, isEmpresaUser } from "@/lib/storage";
import { toast } from "sonner";
import logoPsicosafety from "@/assets/psicosafety-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso à plataforma | PSICOSAFETY" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

type AccountType = "consultor" | "empresa_direta";

async function routeAfterLogin(): Promise<"/admin" | "/empresa" | "/admin/assinar"> {
  // Se o usuário escolheu um plano antes do login, vai direto para a página de assinar
  try {
    if (typeof window !== "undefined" && sessionStorage.getItem("pendingPlan")) {
      return "/admin/assinar";
    }
  } catch {}
  if (await isAdmin()) return "/admin";
  const empresaOnly = await isEmpresaUser();
  if (empresaOnly) return "/empresa";
  return "/admin";
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("empresa_direta");
  const [loading, setLoading] = useState(false);

  // Se já estiver logado, manda direto pro painel certo
  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) return;
      const dest = await routeAfterLogin();
      navigate({ to: dest });
    })();
  }, [navigate]);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(email, pass);
      const dest = await routeAfterLogin();
      toast.success("Bem-vindo!");
      navigate({ to: dest });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminSignup(email, pass, name, accountType);
      // Tenta logar automaticamente após o cadastro
      try {
        await adminLogin(email, pass);
        const dest = await routeAfterLogin();
        toast.success("Conta criada! Bem-vindo.");
        navigate({ to: dest });
      } catch {
        toast.success("Conta criada! Verifique seu e-mail para confirmar e então faça login.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no cadastro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-secondary/40">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardContent className="pt-8">
            <div className="flex justify-center">
              <img src={logoPsicosafety} alt="PSICOSAFETY — Gestão de Riscos Psicossociais" className="h-28 w-auto object-contain" />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Entre com suas credenciais para acessar os relatórios da sua empresa
            </p>

            <Tabs defaultValue="login" className="mt-6">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={submitLogin} className="mt-4 space-y-4">
                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" placeholder="seuemail@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                  </div>
                  <div>
                    <Label htmlFor="pass">Senha</Label>
                    <Input id="pass" type="password" placeholder="Sua senha" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>


                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={submitSignup} className="mt-4 space-y-4">
                  <div>
                    <Label className="mb-2 block">Sou...</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountType("consultor")}
                        className={`p-3 rounded-lg border text-left transition ${accountType === "consultor" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
                      >
                        <Briefcase className="h-4 w-4 mb-1.5 text-primary" />
                        <div className="text-sm font-semibold">Consultor</div>
                        <div className="text-[11px] text-muted-foreground">Atendo várias empresas</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType("empresa_direta")}
                        className={`p-3 rounded-lg border text-left transition ${accountType === "empresa_direta" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"}`}
                      >
                        <Building2 className="h-4 w-4 mb-1.5 text-primary" />
                        <div className="text-sm font-semibold">Empresa</div>
                        <div className="text-[11px] text-muted-foreground">Avaliar minha equipe</div>
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
                      <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0" />
                      Acesso de administrador é concedido manualmente — não está disponível no cadastro público.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="email2">E-mail</Label>
                    <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                  </div>
                  <div>
                    <Label htmlFor="pass2">Senha</Label>
                    <Input id="pass2" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" minLength={6} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Ainda não tem conta de empresa atribuída? <a href="https://wa.me/5588996349359?text=Ol%C3%A1!%20Gostaria%20de%20uma%20conta%20de%20empresa%20na%20PSICOSAFETY." target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Fale conosco</a>
            </p>
          </CardContent>
        </Card>
        <p className="text-[11px] text-muted-foreground mt-4 text-center">© {new Date().getFullYear()} PSICOSAFETY</p>
      </div>
    </div>
  );
}
