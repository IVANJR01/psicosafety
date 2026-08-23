
-- Enum tipos de campanha
DO $$ BEGIN
  CREATE TYPE public.campaign_type AS ENUM ('general', 'sector_reassessment', 'complementary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_scope_mode AS ENUM ('all_sectors', 'selected_sectors');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Novos campos em campanhas
ALTER TABLE public.campanhas
  ADD COLUMN IF NOT EXISTS campaign_type public.campaign_type NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS scope_mode public.campaign_scope_mode NOT NULL DEFAULT 'all_sectors',
  ADD COLUMN IF NOT EXISTS parent_campaign_id uuid REFERENCES public.campanhas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_campanhas_parent ON public.campanhas(parent_campaign_id);

-- Tabela de setores da campanha (escopo)
CREATE TABLE IF NOT EXISTS public.campaign_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  setor_id uuid NOT NULL REFERENCES public.empresa_setores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, setor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_sectors TO authenticated;
GRANT ALL ON public.campaign_sectors TO service_role;

ALTER TABLE public.campaign_sectors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_campaign_sectors_campaign ON public.campaign_sectors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sectors_setor ON public.campaign_sectors(setor_id);

CREATE POLICY "Read campaign_sectors scoped" ON public.campaign_sectors
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'tecnico'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = campaign_sectors.empresa_id AND e.owner_user_id = auth.uid()
    ))
    OR (public.has_role(auth.uid(), 'empresa'::app_role) AND empresa_id = public.current_user_empresa_id())
  );

CREATE POLICY "Insert campaign_sectors" ON public.campaign_sectors
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = campaign_sectors.empresa_id AND e.owner_user_id = auth.uid()
    ))
  );

CREATE POLICY "Delete campaign_sectors" ON public.campaign_sectors
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = campaign_sectors.empresa_id AND e.owner_user_id = auth.uid()
    ))
  );

CREATE POLICY "Update campaign_sectors" ON public.campaign_sectors
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
      SELECT 1 FROM public.empresas e WHERE e.id = campaign_sectors.empresa_id AND e.owner_user_id = auth.uid()
    ))
  );
