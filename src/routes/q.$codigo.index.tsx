import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Brain, ShieldCheck, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DIMENSIONS, loadDimensions, type Answers, type Dimension } from "@/lib/copsoq";
import { getEmpresa, saveResposta } from "@/lib/storage";
import { toast } from "sonner";

export const Route = createFileRoute("/q/$codigo/")({
  validateSearch: (s: Record<string, unknown>) => ({
    setor: typeof s.setor === "string" ? s.setor : undefined,
    funcao: typeof s.funcao === "string" ? s.funcao : undefined,
    exp: s.exp ? Number(s.exp) : undefined,
    sig: typeof s.sig === "string" ? s.sig : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Questionário Anônimo de Riscos Psicossociais" },
      { name: "description", content: "Responda o questionário anônimo de riscos psicossociais da sua empresa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Questionario,
});

function LinkExpirado() {
  return (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Link expirado</h1>
        <p className="mt-2 text-muted-foreground">Solicite um novo link à sua empresa.</p>
        <Button asChild className="mt-6"><Link to="/">Início</Link></Button>
      </div>
    </div>
  );
}

function EmpresaInvalida() {
  return (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Código de empresa inválido</h1>
        <p className="mt-2 text-muted-foreground">Verifique o link recebido pela sua empresa.</p>
        <Button asChild className="mt-6"><Link to="/">Início</Link></Button>
      </div>
    </div>
  );
}

function normalizeLookup(v: string) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// STEPS é computado dentro do componente para refletir as perguntas carregadas do banco.

function Questionario() {
  const { codigo } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Awaited<ReturnType<typeof getEmpresa>> | undefined>(undefined);
  useEffect(() => { (async () => setEmpresa(await getEmpresa(codigo) ?? null))(); }, [codigo]);
  const [dims, setDims] = useState<Dimension[]>(DIMENSIONS);
  useEffect(() => { loadDimensions().then((d) => setDims([...d])); }, []);
  const [step, setStep] = useState(0);
  const [setor, setSetor] = useState(search.setor ?? "");
  const [cargo, setCargo] = useState(search.funcao ?? "");
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const setorLocked = !!search.setor;
  const cargoLocked = !!search.funcao;
  const expirado = !!search.exp && Date.now() > search.exp;

  const STEPS = ["Identificação", ...dims.map((d) => d.title)];
  const totalSteps = STEPS.length;
  const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step, totalSteps]);

  const currentDim = step > 0 ? dims[step - 1] : null;

  const canAdvance = useMemo(() => {
    if (step === 0) {
      const temSetores = (empresa?.setoresFull ?? []).length > 0 || (empresa?.setores ?? []).length > 0;
      const temFuncoes = (empresa?.funcoesFull ?? []).length > 0;
      if (temSetores && !setor.trim()) return false;
      if (temFuncoes && !cargo.trim()) return false;
      return true;
    }
    return currentDim!.questions.every((q) => answers[q.id] !== undefined);
  }, [step, currentDim, answers, empresa, setor, cargo]);

  const next = () => {
    if (!canAdvance) {
      if (step === 0) {
        toast.error("Selecione o setor e a função/cargo para continuar.");
      } else {
        toast.error("Responda todas as perguntas para continuar.");
      }
      return;
    }
    if (step < totalSteps - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!empresa) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      await saveResposta({
        codigoEmpresa: empresa.codigo,
        nomeEmpresa: empresa.nome,
        setor: setor.trim(),
        cargo: cargo.trim(),
        answers,
        exp: search.exp,
        sig: search.sig,
        campanhaCodigo: empresa.campanhaCodigo,
      });
      navigate({ to: "/q/$codigo/obrigado", params: { codigo } });
    } catch (err) {
      console.error("Erro ao enviar respostas", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg === "Link expirado" || msg === "Link inválido" || msg === "Campanha encerrada" || msg === "Campanha inativa" || msg === "Campanha ainda não iniciada") {
        toast.error(msg + ". Solicite um novo link à sua empresa.");
      } else {
        toast.error("Erro ao enviar respostas. Tente novamente.");
      }
      setSubmitting(false);
    }
  };

  if (empresa === undefined) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando...</div>;
  }
  if (empresa === null) {
    return <EmpresaInvalida />;
  }
  if (expirado) {
    return <LinkExpirado />;
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Brain className="h-4 w-4" />
            </span>
            <span>PsicoSafe</span>
          </Link>
          <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-success" /> Resposta anônima
          </span>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{empresa.nome}</span>
          <span className="text-muted-foreground">Etapa {step + 1} de {totalSteps}</span>
        </div>
        <Progress value={progress} className="h-2 mb-6" />

        <Card>
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold">{STEPS[step]}</h1>

            {step === 0 ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
                  <p>
                    Este questionário avalia <strong>fatores de risco psicossociais relacionados ao
                    trabalho</strong> conforme a NR-01. Suas respostas são <strong>anônimas</strong> —
                    não solicitamos nome, CPF ou e-mail. Os dados serão usados apenas de forma agregada.
                  </p>
                </div>
                <div>
                  <Label htmlFor="setor">GES / Setores {setorLocked ? "" : <span className="text-destructive">*</span>}</Label>
                  {setorLocked ? (
                    <Input id="setor" value={setor} disabled className="bg-muted" />
                  ) : empresa.setores && empresa.setores.length > 0 ? (
                    <select
                      id="setor"
                      value={setor}
                      onChange={(e) => { setSetor(e.target.value); setCargo(""); }}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm"
                    >
                      <option value="">Selecione...</option>
                      {empresa.setores.map((s: string) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  ) : (
                    <Input id="setor" maxLength={80} value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Ex.: Produção, Administrativo..." />
                  )}
                </div>
                <div>
                  <Label htmlFor="cargo">Função / Cargo {cargoLocked ? "" : <span className="text-destructive">*</span>}</Label>
                  {cargoLocked ? (
                    <Input id="cargo" value={cargo} disabled className="bg-muted" />
                  ) : (() => {
                    // Hierarquia setor → função: mostra apenas cargos vinculados ao setor escolhido.
                    // Mesma função pode existir em setores diferentes (sem dedup global).
                    const setoresFull = empresa.setoresFull ?? [];
                    const todas = empresa.funcoesFull ?? [];
                    const temSetores = setoresFull.length > 0;
                    const setorObj = setoresFull.find((s: any) => normalizeLookup(s.nome) === normalizeLookup(setor));

                    // Se a empresa tem setores cadastrados, o cargo depende da seleção do setor.
                    if (temSetores) {
                      if (!setorObj) {
                        return (
                          <Input id="cargo" value="" disabled className="bg-muted" placeholder="Selecione um setor primeiro" />
                        );
                      }
                      const lista = todas.filter((f: any) => String(f.setor_id) === String(setorObj.id));
                      if (lista.length === 0) {
                        return (
                          <div className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted">
                            Nenhum cargo encontrado para este setor
                          </div>
                        );
                      }
                      return (
                        <select
                          id="cargo"
                          value={cargo}
                          onChange={(e) => setCargo(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm"
                        >
                          <option value="">Selecione...</option>
                          {lista.map((f: any) => (<option key={f.id} value={f.nome}>{f.nome}</option>))}
                        </select>
                      );
                    }

                    // Sem setores cadastrados: lista todas as funções (legado).
                    if (todas.length > 0) {
                      return (
                        <select
                          id="cargo"
                          value={cargo}
                          onChange={(e) => setCargo(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm"
                        >
                          <option value="">Selecione...</option>
                          {todas.map((f: any) => (<option key={f.id} value={f.nome}>{f.nome}</option>))}
                        </select>
                      );
                    }
                    return (
                      <Input id="cargo" maxLength={80} value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Operador, Analista..." />
                    );
                  })()}

                </div>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">{currentDim!.description}</p>
                <div className="mt-6 space-y-6">
                  {currentDim!.questions.map((q, idx) => (
                    <div key={q.id} className="rounded-lg border bg-card p-4">
                      <div className="font-medium">
                        <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                        {q.text}
                      </div>
                      <RadioGroup
                        className="mt-3 flex flex-col gap-2"
                        value={answers[q.id]?.toString() ?? ""}
                        onValueChange={(v) => setAnswers({ ...answers, [q.id]: Number(v) })}
                      >
                        {[...q.scale].sort((a, b) => a.value - b.value).map((opt) => {
                          const id = `${q.id}-${opt.value}`;
                          const checked = answers[q.id] === opt.value;
                          return (
                            <Label
                              key={opt.value}
                              htmlFor={id}
                              className={`cursor-pointer rounded-md border px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                checked ? "border-primary bg-primary/10 text-foreground" : "hover:bg-secondary"
                              }`}
                            >
                              <RadioGroupItem id={id} value={opt.value.toString()} />
                              <span>{opt.value}- {opt.label}</span>
                            </Label>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={next} disabled={submitting}>
                {step === totalSteps - 1 ? (
                  <>{submitting ? "Enviando..." : "Enviar respostas"} <Send className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Continuar <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
