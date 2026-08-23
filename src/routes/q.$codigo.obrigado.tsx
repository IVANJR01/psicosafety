import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/q/$codigo/obrigado")({
  head: () => ({
    meta: [
      { title: "Obrigado pela participação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Obrigado,
});

function Obrigado() {
  return (
    <div className="min-h-screen grid place-items-center bg-secondary/40 px-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Obrigado pela sua participação!</h1>
          <p className="mt-2 text-muted-foreground">
            Suas respostas foram enviadas de forma anônima e ajudarão sua empresa a melhorar
            o ambiente de trabalho conforme a NR-01.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
