import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Building2, Layers, Upload, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { getCurrentAccountInfo } from "@/lib/account";

type ParsedRow = { cargo: string; setor?: string };

function cleanText(v: unknown) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function normalizeLookup(v: string) {
  return cleanText(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(k: string) {
  return String(k || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const rows: ParsedRow[] = json.flatMap((r) => {
          const map: Record<string, any> = {};
          for (const k of Object.keys(r)) map[normalizeKey(k)] = r[k];
          const cargoRaw = cleanText(map["cargo"] ?? map["funcao"] ?? map["funcao/cargo"] ?? map["funcao cargo"] ?? "");
          const setor = cleanText(map["setor"] ?? map["ges"] ?? map["ghe"] ?? "");
          return cargoRaw
            .split(/\r?\n|;|\s\/\s/g)
            .map((cargo) => ({ cargo: cleanText(cargo), setor: setor || undefined }));
        }).filter((r) => r.cargo && r.setor);
        resolve(rows);
      } catch (e: any) {
        reject(e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export const Route = createFileRoute("/admin/cargos")({
  component: CargosPage,
});

type Empresa = { id: string; nome: string };
type Setor = { id: string; empresa_id: string; nome: string };
type Funcao = { id: string; empresa_id: string; nome: string; setor_id: string | null };

function CargosPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [setorId, setSetorId] = useState<string>("__none__");
  const [novo, setNovo] = useState("");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const info = await getCurrentAccountInfo();
    let empQ = supabase.from("empresas").select("id, nome").order("nome");
    if (info?.accountType === "consultor") {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) empQ = empQ.eq("owner_user_id", u.user.id);
    }
    const [e, s, f] = await Promise.all([
      empQ,
      supabase.from("empresa_setores").select("id, empresa_id, nome").eq("status", "active").order("nome"),
      supabase.from("empresa_funcoes").select("id, empresa_id, nome, setor_id").order("nome"),
    ]);
    const empList = e.data ?? [];
    setEmpresas(empList);
    const allowedIds = new Set(empList.map((x: any) => x.id));
    setSetores((s.data ?? []).filter((x: any) => allowedIds.has(x.empresa_id)));
    setFuncoes((f.data ?? []).filter((x: any) => allowedIds.has(x.empresa_id)));
    if (!empresaId && empList[0]) setEmpresaId(empList[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setoresEmpresa = setores.filter((s) => s.empresa_id === empresaId);
  const funcoesEmpresa = funcoes.filter((f) => f.empresa_id === empresaId);

  const adicionar = async () => {
    if (!empresaId || !novo.trim()) return;
    const { error } = await supabase.from("empresa_funcoes").insert({
      empresa_id: empresaId,
      nome: novo.trim(),
      setor_id: setorId === "__none__" ? null : setorId,
    });
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("uniq_empresa_funcoes_nome_setor") || (error as any).code === "23505") {
        return toast.error("Este cargo já está cadastrado neste setor para esta empresa.");
      }
      return toast.error(msg);
    }
    toast.success("Cargo adicionado");
    setNovo("");
    load();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from("empresa_funcoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cargo removido");
    load();
  };

  const setorNome = (id: string | null) =>
    id ? setores.find((s) => s.id === id)?.nome ?? "—" : "Sem setor";
  const empresaNome = (id: string) =>
    empresas.find((x) => x.id === id)?.nome ?? "—";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!empresaId) return toast.error("Selecione uma empresa antes.");
    try {
      const rows = await parseSpreadsheet(file);
      if (rows.length === 0) return toast.error("Nenhum cargo encontrado na planilha.");
      setImportRows(rows);
      setImportOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler planilha");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmarImport = async () => {
    if (!empresaId || importRows.length === 0) return;
    setImporting(true);
    try {
      // A duplicidade é por vínculo: mesma empresa + mesmo setor + mesmo cargo.
      // O mesmo cargo em setores diferentes deve ser criado normalmente.
      const norm = (s: string) => normalizeLookup(s).replace(/[\s\p{P}]+$/u, "");
      // mapa de setores existentes (normalizado -> id)
      const setMap = new Map<string, string>();
      for (const s of setoresEmpresa) setMap.set(norm(s.nome), s.id);
      // funções existentes para dedup
      const existentes = new Set(
        funcoesEmpresa.map((f) => `${f.setor_id ?? "null"}|${norm(f.nome)}`)
      );

      let criadosSetores = 0;
      let criadosCargos = 0;
      let ignorados = 0;
      const erros: string[] = [];

      for (const r of importRows) {
        try {
          let sId: string | null = null;
          if (r.setor) {
            const key = norm(r.setor);
            const existing = setMap.get(key);
            if (existing) {
              sId = existing;
            } else {
              const { data, error } = await supabase
                .from("empresa_setores")
                .insert({ empresa_id: empresaId, nome: cleanText(r.setor) })
                .select("id")
                .single();
              if (error) throw error;
              sId = data!.id;
              setMap.set(key, sId);
              criadosSetores++;
            }
          }
          const cargoLimpo = cleanText(r.cargo);
          const dedupKey = `${sId ?? "null"}|${norm(cargoLimpo)}`;
          if (existentes.has(dedupKey)) { ignorados++; continue; }
          const { error } = await supabase
            .from("empresa_funcoes")
            .insert({ empresa_id: empresaId, nome: cargoLimpo, setor_id: sId });
          if (error) {
            // duplicate key vindo do índice único = ignorado, não erro
            if (String(error.message || "").toLowerCase().includes("duplicate")) {
              ignorados++; existentes.add(dedupKey); continue;
            }
            throw error;
          }
          existentes.add(dedupKey);
          criadosCargos++;
        } catch (e: any) {
          erros.push(`${r.cargo}: ${e?.message ?? e}`);
        }
      }

      toast.success(
        `${criadosCargos} cargo(s) criado(s)${criadosSetores ? `, ${criadosSetores} setor(es)` : ""}${ignorados ? `, ${ignorados} ignorado(s)` : ""}.`
      );
      if (erros.length) toast.warning(`${erros.length} erro(s). Ex: ${erros[0]}`);
      setImportOpen(false);
      setImportRows([]);
      load();
    } finally {
      setImporting(false);
    }
  };

  const baixarModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["setor", "cargo"],
      ["Produção", "Auxiliar de Produção"],
      ["Expedição", "Auxiliar de Produção"],
      ["Produção", "Líder de Turno"],
      ["Administrativo", "Analista de RH"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cargos");
    XLSX.writeFile(wb, "modelo-cargos.xlsx");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cargos"
        description="Cadastre os cargos/funções vinculadas às empresas e setores."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Novo cargo</CardTitle>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={baixarModelo}>
              <Download className="h-4 w-4 mr-1" /> Modelo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={!empresaId}
            >
              <Upload className="h-4 w-4 mr-1" /> Importar planilha
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <Select value={empresaId} onValueChange={(v) => { setEmpresaId(v); setSetorId("__none__"); }}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger><SelectValue placeholder="Setor (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem setor</SelectItem>
              {setoresEmpresa.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Nome do cargo (ex: Operador)"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
          />
          <Button onClick={adicionar}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cargos cadastrados
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({funcoesEmpresa.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : funcoesEmpresa.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum cargo cadastrado para esta empresa.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {funcoesEmpresa.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{f.nome}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />{empresaNome(f.empresa_id)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />{setorNome(f.setor_id)}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remover(f.id)}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Importar cargos
            </DialogTitle>
            <DialogDescription>
              {importRows.length} vínculo(s) setor + cargo encontrados para a empresa{" "}
              <span className="font-medium">{empresaNome(empresaId)}</span>.
              A mesma função pode aparecer em setores diferentes — só é tratada
              como duplicada quando setor <strong>e</strong> função forem idênticos.
              Linhas sem setor ou sem função são descartadas. Setores novos são
              criados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Setor</th>
                  <th className="text-left px-3 py-2">Cargo</th>
                </tr>
              </thead>
              <tbody>
                {importRows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 text-muted-foreground">{r.setor || "—"}</td>
                    <td className="px-3 py-1.5">{r.cargo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importRows.length > 200 && (
              <div className="text-xs text-muted-foreground p-2">
                … mais {importRows.length - 200} linha(s)
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={confirmarImport} disabled={importing}>
              {importing ? "Importando..." : "Confirmar importação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
