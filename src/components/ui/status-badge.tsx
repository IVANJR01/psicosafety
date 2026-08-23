import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusKind =
  | "ativo"
  | "inativo"
  | "pendente"
  | "em-analise"
  | "concluido"
  | "erro"
  | "critico"
  | "alto"
  | "medio"
  | "moderado"
  | "baixo"
  | "toleravel";

const MAP: Record<StatusKind, { label: string; classes: string; dot: string }> = {
  ativo:        { label: "Ativo",      classes: "bg-success/15 text-success border-success/30",         dot: "bg-success" },
  inativo:      { label: "Inativo",    classes: "bg-muted text-muted-foreground border-border",          dot: "bg-muted-foreground" },
  pendente:     { label: "Pendente",   classes: "bg-warning/15 text-warning-foreground border-warning/40", dot: "bg-warning" },
  "em-analise": { label: "Em análise", classes: "bg-primary/10 text-primary border-primary/30",          dot: "bg-primary" },
  concluido:    { label: "Concluído",  classes: "bg-success/15 text-success border-success/30",          dot: "bg-success" },
  erro:         { label: "Erro",       classes: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  critico:      { label: "Crítico",    classes: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  alto:         { label: "Alto",       classes: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" },
  medio:        { label: "Médio",      classes: "bg-warning/15 text-warning-foreground border-warning/40",  dot: "bg-warning" },
  moderado:     { label: "Moderado",   classes: "bg-warning/15 text-warning-foreground border-warning/40",  dot: "bg-warning" },
  baixo:        { label: "Baixo",      classes: "bg-success/15 text-success border-success/30",          dot: "bg-success" },
  toleravel:    { label: "Tolerável",  classes: "bg-primary/10 text-primary border-primary/30",          dot: "bg-primary" },
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusKind;
  label?: string;
  withDot?: boolean;
}

export function StatusBadge({ status, label, withDot = true, className, ...props }: StatusBadgeProps) {
  const meta = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        meta.classes,
        className,
      )}
      {...props}
    >
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />}
      {label ?? meta.label}
    </span>
  );
}
