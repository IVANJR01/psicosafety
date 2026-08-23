
-- Restringe leitura de empresas por papel (admin vê tudo; consultor só as suas; empresa só a sua).
-- Mantém leitura pública para anônimos (necessária para o fluxo público do questionário via /q/:codigo).

DROP POLICY IF EXISTS "Read empresas public" ON public.empresas;

-- Anônimos (questionário público): mantém leitura
CREATE POLICY "Anon reads empresas"
ON public.empresas
FOR SELECT
TO anon
USING (true);

-- Autenticados: restrito por papel
CREATE POLICY "Auth reads empresas scoped"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'consultor'::app_role) AND owner_user_id = auth.uid())
  OR (public.has_role(auth.uid(), 'empresa'::app_role) AND id = public.current_user_empresa_id())
  OR public.has_role(auth.uid(), 'tecnico'::app_role)
);
