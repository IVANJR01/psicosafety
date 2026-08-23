import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { listProfiles, listEmpresas, setUserEmpresa, setUserRole, listUserRoles, type ProfileRow, type Empresa } from "@/lib/storage";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{ title: "Usuários | PsicoSafe Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsuariosAdmin,
});

const NONE = "__none__";

function UsuariosAdmin() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    const [p, e] = await Promise.all([listProfiles(), listEmpresas()]);
    setProfiles(p);
    setEmpresas(e);
    const rs: Record<string, string[]> = {};
    await Promise.all(p.map(async (pr) => { rs[pr.user_id] = await listUserRoles(pr.user_id); }));
    setRoles(rs);
  };

  useEffect(() => { reload(); }, []);

  const handleEmpresa = async (userId: string, empresaId: string) => {
    setBusy(userId);
    try {
      await setUserEmpresa(userId, empresaId === NONE ? null : empresaId);
      toast.success("Empresa atualizada");
      await reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const handleRole = async (userId: string, role: "admin" | "empresa" | "tecnico" | "visualizador", enabled: boolean) => {
    setBusy(userId + role);
    try {
      await setUserRole(userId, role, enabled);
      toast.success(enabled ? `Role "${role}" concedida` : `Role "${role}" removida`);
      await reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Vincule contas a empresas e gerencie permissões (admin / empresa)."
      />

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Empresa vinculada</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-center">Técnico</TableHead>
                <TableHead className="text-center">Empresa</TableHead>
                <TableHead className="text-center">Visualiz.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-2">
                  <EmptyState
                    icon={Users}
                    title="Sem usuários"
                    description="Quando alguém criar conta em /login, aparecerá aqui para você vincular à empresa."
                  />
                </TableCell></TableRow>
              )}
              {profiles.map((p) => {
                const userRoles = roles[p.user_id] ?? [];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.display_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.email}</TableCell>
                    <TableCell>
                      <Select
                        value={p.empresa_id ?? NONE}
                        onValueChange={(v) => handleEmpresa(p.user_id, v)}
                        disabled={busy === p.user_id}
                      >
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— sem vínculo —</SelectItem>
                          {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {(["admin","tecnico","empresa","visualizador"] as const).map((r) => (
                      <TableCell key={r} className="text-center">
                        <Switch
                          checked={userRoles.includes(r)}
                          onCheckedChange={(v) => handleRole(p.user_id, r, v)}
                          disabled={busy === p.user_id + r}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-4">
            <strong>Como dar acesso a um cliente:</strong> peça para a pessoa criar conta em <code>/login</code> (aba Criar conta),
            depois aqui ative o switch <strong>Empresa</strong> e selecione a empresa correspondente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
