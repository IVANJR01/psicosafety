import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/empresa/login")({
  head: () => ({ meta: [{ title: "Acesso | PSICOSAFETY" }, { name: "robots", content: "noindex" }] }),
  component: RedirectToLogin,
});

function RedirectToLogin() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/login", replace: true });
  }, [navigate]);
  return <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">Redirecionando…</div>;
}
