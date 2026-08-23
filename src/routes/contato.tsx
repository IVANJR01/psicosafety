import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | PsicoSafe NR-01" },
      { name: "description", content: "Fale com nossa equipe sobre conformidade com a NR-01." },
    ],
  }),
  component: Contato,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  mensagem: z.string().trim().min(10, "Mensagem muito curta").max(1000),
});

function Contato() {
  const [form, setForm] = useState({ nome: "", email: "", mensagem: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      toast.error(r.error.issues[0].message);
      return;
    }
    toast.success("Mensagem enviada! Retornaremos em breve.");
    setForm({ nome: "", email: "", mensagem: "" });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-4xl font-bold">Contato</h1>
      <p className="mt-3 text-muted-foreground">
        Tire dúvidas sobre a aplicação da NR-01 na sua empresa.
      </p>

      <Card className="mt-8">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
            </div>
            <div>
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea id="mensagem" rows={5} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} maxLength={1000} />
            </div>
            <Button type="submit" className="w-full">Enviar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
