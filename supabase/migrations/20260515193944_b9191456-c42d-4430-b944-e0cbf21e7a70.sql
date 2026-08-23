
DROP POLICY IF EXISTS "Admins insert campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Admins update campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Admins delete campanhas" ON public.campanhas;

CREATE POLICY "Insert campanhas" ON public.campanhas
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = campanhas.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Update campanhas" ON public.campanhas
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = campanhas.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = campanhas.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Delete campanhas" ON public.campanhas
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = campanhas.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);
