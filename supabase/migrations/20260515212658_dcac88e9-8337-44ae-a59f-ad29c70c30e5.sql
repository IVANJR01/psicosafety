
-- ============ RESPOSTAS ============
-- A política "Consultor read respostas das suas empresas" já existe. Aqui apenas
-- garantimos que não há SELECT público para autenticados além das já corretas.
-- Nada a alterar em respostas (políticas já estão corretas).

-- ============ CAMPANHAS ============
DROP POLICY IF EXISTS "Anyone reads campanhas" ON public.campanhas;

CREATE POLICY "Anon reads campanhas"
ON public.campanhas
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Auth reads campanhas scoped"
ON public.campanhas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'tecnico'::app_role)
  OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = campanhas.empresa_id AND e.owner_user_id = auth.uid()
      ))
  OR (public.has_role(auth.uid(), 'empresa'::app_role)
      AND empresa_id = public.current_user_empresa_id())
);

-- ============ EMPRESA_SETORES ============
DROP POLICY IF EXISTS "Anyone reads setores" ON public.empresa_setores;

CREATE POLICY "Anon reads setores"
ON public.empresa_setores
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Auth reads setores scoped"
ON public.empresa_setores
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'tecnico'::app_role)
  OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = empresa_setores.empresa_id AND e.owner_user_id = auth.uid()
      ))
  OR (public.has_role(auth.uid(), 'empresa'::app_role)
      AND empresa_id = public.current_user_empresa_id())
);

-- ============ EMPRESA_FUNCOES ============
DROP POLICY IF EXISTS "Anyone reads funcoes" ON public.empresa_funcoes;

CREATE POLICY "Anon reads funcoes"
ON public.empresa_funcoes
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Auth reads funcoes scoped"
ON public.empresa_funcoes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'tecnico'::app_role)
  OR (public.has_role(auth.uid(), 'consultor'::app_role) AND EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = empresa_funcoes.empresa_id AND e.owner_user_id = auth.uid()
      ))
  OR (public.has_role(auth.uid(), 'empresa'::app_role)
      AND empresa_id = public.current_user_empresa_id())
);
