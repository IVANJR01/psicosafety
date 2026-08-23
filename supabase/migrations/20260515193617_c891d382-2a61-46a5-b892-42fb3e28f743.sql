
-- empresa_setores: permitir consultor dono da empresa
DROP POLICY IF EXISTS "Admins insert setores" ON public.empresa_setores;
DROP POLICY IF EXISTS "Admins update setores" ON public.empresa_setores;
DROP POLICY IF EXISTS "Admins delete setores" ON public.empresa_setores;

CREATE POLICY "Insert setores" ON public.empresa_setores
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_setores.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Update setores" ON public.empresa_setores
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_setores.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_setores.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Delete setores" ON public.empresa_setores
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_setores.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

-- empresa_funcoes: idem
DROP POLICY IF EXISTS "Admins insert funcoes" ON public.empresa_funcoes;
DROP POLICY IF EXISTS "Admins update funcoes" ON public.empresa_funcoes;
DROP POLICY IF EXISTS "Admins delete funcoes" ON public.empresa_funcoes;

CREATE POLICY "Insert funcoes" ON public.empresa_funcoes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_funcoes.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Update funcoes" ON public.empresa_funcoes
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_funcoes.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_funcoes.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Delete funcoes" ON public.empresa_funcoes
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_funcoes.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);
