import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertOctagon, Copy, Check, FileWarning } from "lucide-react";
import { toast } from "sonner";

export type AEPErrorInfo = {
  etapa: string;
  empresaCodigo: string;
  empresaNome: string;
  campanha: string;
  setor: string;
  periodoInicio?: string;
  periodoFim?: string;
  qtdRespostas: number;
  qtdGesCadastrados: number;
  qtdGesAvaliados?: number;
  qtdGesSemAvaliacao?: number;
  somenteAvaliados: boolean;
  rascunho: boolean;
  errorName: string;
  errorMessage: string;
  errorCode?: string;
  errorStatus?: number | string;
  apiResponse?: string;
  stack?: string;
  ambiente: string;
  timestamp: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  info: AEPErrorInfo | null;
};

function fmtDiagnostico(info: AEPErrorInfo): string {
  const lines = [
    "===== DIAGNÓSTICO AEP PDF — Psicosafety =====",
    `Data/hora......: ${info.timestamp}`,
    `Ambiente.......: ${info.ambiente}`,
    "",
    "--- Contexto ---",
    `Empresa........: ${info.empresaNome} (${info.empresaCodigo || "—"})`,
    `Campanha.......: ${info.campanha}`,
    `Setor/GES......: ${info.setor}`,
    `Período........: ${info.periodoInicio || "—"} → ${info.periodoFim || "—"}`,
    `Respostas......: ${info.qtdRespostas}`,
    `GES cadastrados: ${info.qtdGesCadastrados}`,
    `GES avaliados..: ${info.qtdGesAvaliados ?? "—"}`,
    `GES sem aval...: ${info.qtdGesSemAvaliacao ?? "—"}`,
    `Somente aval...: ${info.somenteAvaliados ? "sim" : "não"}`,
    `Rascunho.......: ${info.rascunho ? "sim" : "não"}`,
    "",
    "--- Falha ---",
    `Etapa..........: ${info.etapa}`,
    `Tipo erro......: ${info.errorName}`,
    `Código.........: ${info.errorCode ?? "—"}`,
    `HTTP status....: ${info.errorStatus ?? "—"}`,
    `Mensagem.......: ${info.errorMessage}`,
    "",
  ];
  if (info.apiResponse) {
    lines.push("--- Resposta da API ---");
    lines.push(info.apiResponse);
    lines.push("");
  }
  if (info.stack) {
    lines.push("--- Stack trace ---");
    lines.push(info.stack);
  }
  return lines.join("\n");
}

export function AEPErrorDialog({ open, onOpenChange, info }: Props) {
  const [copied, setCopied] = useState(false);
  const texto = useMemo(() => (info ? fmtDiagnostico(info) : ""), [info]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      toast.success("Diagnóstico copiado para a área de transferência");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: seleciona textarea
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast.success("Diagnóstico copiado");
      } catch {
        toast.error("Não foi possível copiar. Selecione manualmente o texto.");
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="h-5 w-5" />
            Falha ao gerar o Relatório AEP
          </DialogTitle>
          <DialogDescription>
            O PDF não foi gerado. Abaixo o diagnóstico completo — use o botão{" "}
            <strong>Copiar diagnóstico</strong> para enviar ao suporte da Psicosafety.
          </DialogDescription>
        </DialogHeader>

        {info && (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-destructive break-words">
                    {info.errorName}: {info.errorMessage}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Etapa que falhou: <span className="font-mono">{info.etapa}</span>
                    {info.errorCode ? <> · código <span className="font-mono">{info.errorCode}</span></> : null}
                    {info.errorStatus ? <> · HTTP <span className="font-mono">{info.errorStatus}</span></> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-muted-foreground">Empresa:</span> <strong>{info.empresaNome}</strong> ({info.empresaCodigo || "—"})</div>
              <div><span className="text-muted-foreground">Campanha:</span> <strong>{info.campanha}</strong></div>
              <div><span className="text-muted-foreground">Setor/GES:</span> <strong>{info.setor}</strong></div>
              <div><span className="text-muted-foreground">Respostas:</span> <strong>{info.qtdRespostas}</strong></div>
              <div><span className="text-muted-foreground">GES cadastrados:</span> <strong>{info.qtdGesCadastrados}</strong></div>
              <div><span className="text-muted-foreground">GES avaliados:</span> <strong>{info.qtdGesAvaliados ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">GES sem aval.:</span> <strong>{info.qtdGesSemAvaliacao ?? "—"}</strong></div>
              <div><span className="text-muted-foreground">Período:</span> <strong>{info.periodoInicio || "—"} → {info.periodoFim || "—"}</strong></div>
              <div><span className="text-muted-foreground">Somente aval.:</span> <strong>{info.somenteAvaliados ? "sim" : "não"}</strong></div>
              <div><span className="text-muted-foreground">Rascunho:</span> <strong>{info.rascunho ? "sim" : "não"}</strong></div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Diagnóstico completo</div>
              <ScrollArea className="h-56 rounded-md border bg-muted/30">
                <pre className="p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
{texto}
                </pre>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={copiar} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar diagnóstico do erro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
