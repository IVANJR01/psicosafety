import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona | PsicoSafe NR-01" },
      { name: "description", content: "Passo a passo para aplicar o questionário de riscos psicossociais na sua empresa." },
    ],
  }),
  component: ComoFunciona,
});

const passos = [
  { n: 1, t: "Cadastre sua empresa", d: "Pelo painel administrativo, gere um código único da sua empresa." },
  { n: 2, t: "Compartilhe o link", d: "Envie o link /q/CODIGO aos funcionários por e-mail, intranet ou QR code." },
  { n: 3, t: "Funcionário responde sem login", d: "Resposta totalmente anônima. Apenas setor e cargo (opcional) são informados." },
  { n: 4, t: "Análise no painel", d: "Acompanhe os níveis de risco por dimensão (demandas, organização, liderança, saúde, etc)." },
  { n: 5, t: "Plano de ação", d: "Use os resultados para o inventário de riscos e o plano de ação do GRO." },
];

function ComoFunciona() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold">Como funciona</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        5 passos simples para colocar sua empresa em conformidade com a NR-01.
      </p>

      <div className="mt-10 space-y-4">
        {passos.map((p) => (
          <Card key={p.n}>
            <CardContent className="pt-6 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold">
                {p.n}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{p.t}</h3>
                <p className="text-sm text-muted-foreground mt-1">{p.d}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link
            to="/q/$codigo"
            params={{ codigo: "DEMO01" }}
            search={{ setor: undefined, funcao: undefined, exp: undefined, sig: undefined }}
          >
            Testar questionário (DEMO01)
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/login">Entrar no painel</Link>
        </Button>
      </div>
    </div>
  );
}
