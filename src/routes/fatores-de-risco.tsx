import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Users, Clock, Shield, Brain, Briefcase } from "lucide-react";

export const Route = createFileRoute("/fatores-de-risco")({
  head: () => ({
    meta: [
      { title: "Fatores de Risco Psicossociais | PsicoSafe NR-01" },
      { name: "description", content: "Conheça os fatores de riscos psicossociais relacionados ao trabalho avaliados na NR-01." },
    ],
  }),
  component: Fatores,
});

const fatores = [
  { icon: Clock, title: "Sobrecarga e ritmo de trabalho", desc: "Demandas quantitativas excessivas, prazos curtos e ritmo acelerado." },
  { icon: Brain, title: "Demandas emocionais", desc: "Trabalho que exige esconder sentimentos ou lidar com situações emocionalmente desgastantes." },
  { icon: Briefcase, title: "Baixa autonomia", desc: "Pouca influência sobre as próprias tarefas, métodos e ritmo." },
  { icon: Users, title: "Falta de apoio social", desc: "Pouco apoio de colegas e da chefia, conflitos interpessoais." },
  { icon: Shield, title: "Comportamentos ofensivos", desc: "Assédio moral, assédio sexual, discriminação e violência no trabalho." },
  { icon: AlertTriangle, title: "Insegurança e mudanças", desc: "Insegurança quanto ao futuro do emprego e mudanças mal comunicadas." },
];

function Fatores() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-bold">Fatores de Risco Psicossociais</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Decorrem da concepção, organização e gestão do trabalho. Podem desencadear estresse,
          esgotamento, DORT, depressão e outros agravos à saúde do trabalhador.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {fatores.map((f) => (
          <Card key={f.title} className="border-border/60">
            <CardContent className="pt-6">
              <div className="h-10 w-10 grid place-items-center rounded-lg bg-accent text-accent-foreground mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
