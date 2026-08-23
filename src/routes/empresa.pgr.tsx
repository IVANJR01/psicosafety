import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, ShieldCheck, FileText, BarChart3 } from "lucide-react";
import { getCurrentEmpresa, listRespostasEmpresa, type Empresa, type Resposta } from "@/lib/storage";
import { gerarPgrPdf } from "@/lib/pgr-pdf";
import { aggregateDimensions } from "@/lib/empresa-stats";

export const Route = createFileRoute("/empresa/pgr")({
  head: () => ({ meta: [{ title: "Relatório PGR | Portal da Empresa" }, { name: "robots", content: "noindex" }] }),
  component: PgrPage,
});

function PgrPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [respostas, setRespostas] = useState<Resposta[]>([]);

  useEffect(() => {
    (async () => {
      const e = await getCurrentEmpresa();
      setEmpresa(e);
      if (e) setRespostas(await listRespostasEmpresa(e.id));
    })();
  }, []);

  const aggs = aggregateDimensions(respostas);
  const criticos = aggs.filter((a) => a.n > 0 && a.risco.label === "INTOLERÁVEL").length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Relatório PGR — Riscos Psicossociais</h1>
        <p className="text-sm text-muted-foreground">
          Inventário de Riscos Ocupacionais conforme NR-01 (Portaria MTE 1.419/2024). Pronto para auditoria.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">O relatório inclui</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3"><FileText className="h-5 w-5 text-primary mt-0.5" /><div><strong>Capa institucional</strong> com identificação da empresa, data e metodologia.</div></li>
            <li className="flex gap-3"><BarChart3 className="h-5 w-5 text-primary mt-0.5" /><div><strong>Resumo por dimensão</strong> com score COPSOQ, severidade, probabilidade e classificação P×S.</div></li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary mt-0.5" /><div><strong>Heatmap por GES / Setores</strong> com intensidade de risco visual.</div></li>
            <li className="flex gap-3"><FileDown className="h-5 w-5 text-primary mt-0.5" /><div><strong>Plano de ação recomendado</strong> com prazos por classificação NR-01.</div></li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground uppercase">Respondentes</div>
              <div className="text-2xl font-bold">{respostas.length}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Dimensões</div>
              <div className="text-2xl font-bold">{aggs.length}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Riscos intoleráveis</div>
              <div className={`text-2xl font-bold ${criticos > 0 ? "text-destructive" : ""}`}>{criticos}</div>
            </div>
          </div>

          <Button
            className="w-full mt-6 h-12"
            size="lg"
            onClick={() => empresa && gerarPgrPdf(empresa, respostas)}
            disabled={!empresa || respostas.length === 0}
          >
            <FileDown className="h-5 w-5 mr-2" />
            {respostas.length === 0 ? "Sem respostas para gerar o PGR" : "Baixar Relatório PGR (PDF)"}
          </Button>
          {respostas.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Compartilhe o link do questionário com seus colaboradores para começar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
