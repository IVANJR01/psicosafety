import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/sobre-nr01")({
  head: () => ({
    meta: [
      { title: "Sobre a NR-01 — Riscos Psicossociais | PsicoSafe" },
      { name: "description", content: "O que mudou na NR-01 com a Portaria MTE 1.419/2024 sobre fatores de riscos psicossociais relacionados ao trabalho." },
    ],
  }),
  component: SobreNR01,
});

function SobreNR01() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold">Sobre a NR-01</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Gerenciamento de Riscos Ocupacionais (GRO) com inclusão expressa dos
        fatores de riscos psicossociais relacionados ao trabalho.
      </p>

      <div className="mt-10 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold">O que mudou</h2>
            <p className="mt-2 text-muted-foreground">
              A Portaria MTE nº 1.419, de 27 de agosto de 2024, alterou o capítulo 1.5 da NR-1,
              incluindo expressamente os <strong>fatores de risco psicossociais relacionados ao trabalho</strong>{" "}
              no Gerenciamento de Riscos Ocupacionais (GRO). A vigência iniciou em <strong>26/05/2025</strong>.
            </p>
            <p className="mt-3 text-muted-foreground">
              O GRO agora deve abranger riscos físicos, químicos, biológicos, de acidentes,
              ergonômicos e <strong>psicossociais</strong>, integrando-os ao inventário de riscos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold">Integração com a NR-17</h2>
            <p className="mt-2 text-muted-foreground">
              Os fatores de risco psicossociais estão diretamente relacionados à
              <strong> organização do trabalho</strong> (item 17.1.1.1 da NR-17). Decorrem de
              problemas na concepção, organização e gestão do trabalho, podendo gerar efeitos à
              saúde do trabalhador em nível psicológico, físico e social.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold">Por que isso importa</h2>
            <p className="mt-2 text-muted-foreground">
              Segundo a OIT/OMS (2022), 12 bilhões de dias de trabalho são perdidos
              anualmente no mundo por depressão e ansiedade, custando quase 1 trilhão de dólares
              em perda de produtividade. No Brasil, transtornos mentais figuram em 2º lugar entre
              os adoecimentos ocupacionais (8,35% em 2022).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold">Etapas do GRO</h2>
            <ol className="mt-3 space-y-2 list-decimal list-inside text-muted-foreground">
              <li>Evitar ou eliminar os perigos</li>
              <li>Identificar perigos e avaliar riscos</li>
              <li>Classificar os riscos</li>
              <li>Adotar medidas de prevenção</li>
              <li>Acompanhar o controle dos riscos ocupacionais</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
