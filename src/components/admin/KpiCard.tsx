import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
  className?: string;
};

const toneClasses: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-emerald-600",
  warning: "text-amber-600",
  destructive: "text-destructive",
};

export function KpiCard({ label, value, icon: Icon, hint, tone = "default", className }: Props) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn("h-4 w-4", toneClasses[tone])} />}
      </div>
      <div className={cn("mt-2 text-3xl font-bold tracking-tight", toneClasses[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
