
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.denuncias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  consulta_token text NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  codigo_empresa text,
  categoria text NOT NULL,
  descricao text NOT NULL,
  setor text,
  anonima boolean NOT NULL DEFAULT true,
  nome_denunciante text,
  contato_denunciante text,
  status text NOT NULL DEFAULT 'recebida',
  parecer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_categoria_chk CHECK (categoria IN ('assedio_moral','assedio_sexual','violencia','ameaca','discriminacao','conflito','outros')),
  CONSTRAINT denuncias_status_chk CHECK (status IN ('recebida','em_analise','investigacao','concluida','arquivada')),
  CONSTRAINT denuncias_descricao_chk CHECK (char_length(descricao) BETWEEN 10 AND 5000)
);

CREATE INDEX IF NOT EXISTS idx_denuncias_empresa ON public.denuncias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_status ON public.denuncias(status);

ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit denuncia"
  ON public.denuncias FOR INSERT TO public
  WITH CHECK (
    char_length(descricao) BETWEEN 10 AND 5000
    AND char_length(categoria) <= 30
    AND (codigo_empresa IS NULL OR char_length(codigo_empresa) <= 64)
  );

CREATE POLICY "Admin and tecnico read all denuncias"
  ON public.denuncias FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

CREATE POLICY "Empresa users read own denuncias"
  ON public.denuncias FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'empresa'::app_role) AND empresa_id = current_user_empresa_id());

CREATE POLICY "Admin and tecnico update denuncias"
  ON public.denuncias FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role));

CREATE POLICY "Admin delete denuncias"
  ON public.denuncias FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS denuncias_updated_at ON public.denuncias;
CREATE TRIGGER denuncias_updated_at
  BEFORE UPDATE ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
