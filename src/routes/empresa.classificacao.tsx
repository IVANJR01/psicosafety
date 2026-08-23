import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentEmpresa, listRespostasEmpresa, type Resposta } from "@/lib/storage";
import { aggregateBySetor, aggregateDimensions, classifyRisco, probFromScore, SEVERIDADE_DIM, type Nivel } from "@/lib/empresa-stats";
import { DIMENSIONS } from "@/lib/copsoq";

export const Route = createFileRoute("/empresa/classificacao")({
  head: () => ({ meta: [{ title: "Classificação de Risco | Portal" }, { name: "robots", content: "noindex" }] }),
  component: ClassificacaoEmpresa,
});

const SEV_LABEL: Record<Nivel, string> = { 1: "Leve", 2: "Baixa", 3: "Moderada", 4: "Alta", 5: "Crítica" };
const PROB_LABEL: Record<Nivel, string> = { 1: "Baixa", 2: "Moderada", 3: "Significativa", 4: "Alta", 5: "Muito alta" };

function ClassificacaoEmpresa() {
  const [respostas, setRespostas] = useState<Resposta[]>([]);

  useEffect(() => {
    (async () => {
      const e = await getCurrentEmpresa();
      if (e) setRespostas(await listRespostasEmpresa(e.id));
    })();
  }, []);

  const setores = useMemo(() => aggregateBySetor(respostas), [respostas]);
  const aggGeral = useMemo(() => aggregateDimensions(respostas), [respostas]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Classificação NR-01</h1>
        <p className="text-sm text-muted-foreground">
          Matriz Probabilidade × Severidade conforme item 1.5.4 da NR-01.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">Visão geral por dimensão</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dimensão</TableHead>
                  <TableHead className="w-20 text-right">Score</TableHead>
                  <TableHead>Probabilidade</TableHead>
                  <TableHead>Severidade (NR-01)</TableHead>
                  <TableHead>Risco (P×S)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggGeral.map((a) => (
                  <TableRow key={a.dim.id}>
                    <TableCell className="font-medium">{a.dim.title}</TableCell>
                    <TableCell className="text-right font-mono">{a.n > 0 ? `${a.score}%` : "—"}</TableCell>
                    <TableCell className="text-xs">{a.n > 0 ? `${a.prob} — ${PROB_LABEL[a.prob]}` : "—"}</TableCell>
                    <TableCell className="text-xs">{a.sev} — {SEV_LABEL[a.sev]}</TableCell>
                    <TableCell>
                      {a.n > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: a.risco.color }}>
                          {a.risco.nivel} — {a.risco.label}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">Sem dados</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {setores.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">Por GES / Setores</h2>
            <div className="space-y-6">
              {setores.map((s) => (
                <div key={s.setor}>
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="font-semibold">{s.setor}</h3>
                    <span className="text-xs text-muted-foreground">{s.n} resposta(s)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dimensão</TableHead>
                          <TableHead className="w-20 text-right">Score</TableHead>
                          <TableHead>Risco (P×S)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {s.porDim.map((d) => {
                          const dim = DIMENSIONS.find((x) => x.id === d.dimId)!;
                          const p = probFromScore(d.score);
                          const sev = (SEVERIDADE_DIM[d.dimId] ?? 2) as Nivel;
                          const risco = classifyRisco(p, sev);
                          return (
                            <TableRow key={d.dimId}>
                              <TableCell className="font-medium">{dim.title}</TableCell>
                              <TableCell className="text-right font-mono">{d.score}%</TableCell>
                              <TableCell>
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: risco.color }}>
                                  {risco.nivel} — {risco.label}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
