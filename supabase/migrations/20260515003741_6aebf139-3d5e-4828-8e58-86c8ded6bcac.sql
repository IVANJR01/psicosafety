
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_empresa_id ON public.profiles(empresa_id);

CREATE OR REPLACE FUNCTION public.current_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_empresa_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_empresa_id() TO authenticated;

DROP POLICY IF EXISTS "Empresa users read own respostas" ON public.respostas;
CREATE POLICY "Empresa users read own respostas"
  ON public.respostas
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'empresa'::app_role)
    AND empresa_id = public.current_user_empresa_id()
  );
