import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentEmpresa, listRespostasEmpresa, type Resposta } from "@/lib/storage";
import { DIMENSIONS, dimensionRiskScore } from "@/lib/copsoq";

export const Route = createFileRoute("/empresa/respostas")({
  head: () => ({ meta: [{ title: "Respostas | Portal da Empresa" }, { name: "robots", content: "noindex" }] }),
  component: RespostasEmpresa,
});

function RespostasEmpresa() {
  const [respostas, setRespostas] = useState<Resposta[]>([]);

  useEffect(() => {
    (async () => {
      const e = await getCurrentEmpresa();
      if (e) setRespostas(await listRespostasEmpresa(e.id));
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold">Respostas anônimas</h1>
      <p className="text-sm text-muted-foreground">{respostas.length} respondente(s) — dados sem identificação pessoal.</p>

      <Card className="mt-6">
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Função</TableHead>
                {DIMENSIONS.map((d) => (
                  <TableHead key={d.id} className="text-right">{d.title.split(" ")[0]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {respostas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + DIMENSIONS.length} className="text-center py-12 text-muted-foreground">
                    Nenhuma resposta ainda.
                  </TableCell>
                </TableRow>
              ) : (
                respostas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.criadoEm).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{r.setor || "—"}</TableCell>
                    <TableCell>{r.cargo || "—"}</TableCell>
                    {DIMENSIONS.map((d) => {
                      const v = dimensionRiskScore(d, r.answers);
                      return <TableCell key={d.id} className="text-right font-mono text-xs">{v ? `${v}%` : "—"}</TableCell>;
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
