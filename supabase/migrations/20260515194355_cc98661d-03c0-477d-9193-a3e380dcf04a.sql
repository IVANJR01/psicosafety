
CREATE POLICY "Consultor read respostas das suas empresas" ON public.respostas
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = respostas.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Consultor delete respostas das suas empresas" ON public.respostas
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = respostas.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

-- Também denuncias para consultor ver as próprias
CREATE POLICY "Consultor read denuncias das suas empresas" ON public.denuncias
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = denuncias.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Consultor update denuncias das suas empresas" ON public.denuncias
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = denuncias.empresa_id
      AND has_role(auth.uid(), 'consultor'::app_role)
      AND e.owner_user_id = auth.uid()
  )
);
