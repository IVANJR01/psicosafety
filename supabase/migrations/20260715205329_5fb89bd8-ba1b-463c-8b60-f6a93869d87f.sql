
CREATE TABLE public.control_measures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  campanha_id UUID REFERENCES public.campanhas(id) ON DELETE SET NULL,
  setor_id UUID REFERENCES public.empresa_setores(id) ON DELETE SET NULL,
  funcao_id UUID REFERENCES public.empresa_funcoes(id) ON DELETE SET NULL,
  dominio TEXT,
  perigo TEXT,
  risk_level_pgr TEXT,
  control_type TEXT NOT NULL CHECK (control_type IN ('existente','recomendada')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nao_evidenciado',
  responsible_name TEXT,
  due_date DATE,
  implementation_date DATE,
  evidence_description TEXT,
  evidence_url TEXT,
  validated BOOLEAN NOT NULL DEFAULT false,
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  effectiveness_status TEXT NOT NULL DEFAULT 'nao_avaliada',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_control_measures_empresa ON public.control_measures(empresa_id);
CREATE INDEX idx_control_measures_setor ON public.control_measures(setor_id);
CREATE INDEX idx_control_measures_lookup ON public.control_measures(empresa_id, setor_id, dominio, control_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.control_measures TO authenticated;
GRANT ALL ON public.control_measures TO service_role;

ALTER TABLE public.control_measures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "control_measures_select" ON public.control_measures
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.owner_user_id = auth.uid()
    ))
    OR (public.has_role(auth.uid(), 'empresa'::app_role) AND empresa_id = public.current_user_empresa_id())
  );

CREATE POLICY "control_measures_insert" ON public.control_measures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.owner_user_id = auth.uid()
    ))
    OR (public.has_role(auth.uid(), 'empresa'::app_role) AND empresa_id = public.current_user_empresa_id())
  );

CREATE POLICY "control_measures_update" ON public.control_measures
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.owner_user_id = auth.uid()
    ))
    OR (public.has_role(auth.uid(), 'empresa'::app_role) AND empresa_id = public.current_user_empresa_id())
  );

CREATE POLICY "control_measures_delete" ON public.control_measures
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.owner_user_id = auth.uid()
    ))
  );

CREATE TRIGGER update_control_measures_updated_at
  BEFORE UPDATE ON public.control_measures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
