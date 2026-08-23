
DROP POLICY IF EXISTS "Anon reads empresas" ON public.empresas;
DROP POLICY IF EXISTS "Anon reads campanhas" ON public.campanhas;
DROP POLICY IF EXISTS "Anon reads setores" ON public.empresa_setores;
DROP POLICY IF EXISTS "Anon reads funcoes" ON public.empresa_funcoes;
DROP POLICY IF EXISTS "Anyone can submit respostas" ON public.respostas;

CREATE OR REPLACE FUNCTION public.get_empresa_publica(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_campanha_codigo text := NULL;
  v_emp public.empresas%ROWTYPE;
  v_setores jsonb;
  v_funcoes jsonb;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_empresa_id FROM public.empresas WHERE lower(codigo) = lower(p_codigo) LIMIT 1;

  IF v_empresa_id IS NULL THEN
    SELECT c.empresa_id, c.codigo
      INTO v_empresa_id, v_campanha_codigo
      FROM public.campanhas c
      WHERE lower(c.codigo) = lower(p_codigo)
        AND c.ativa = true
        AND (c.fim IS NULL OR c.fim > now())
        AND c.inicio <= now()
      LIMIT 1;
    IF v_empresa_id IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT * INTO v_emp FROM public.empresas WHERE id = v_empresa_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) ORDER BY s.nome), '[]'::jsonb)
    INTO v_setores
    FROM public.empresa_setores s WHERE s.empresa_id = v_empresa_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'setor_id', f.setor_id) ORDER BY f.nome), '[]'::jsonb)
    INTO v_funcoes
    FROM public.empresa_funcoes f WHERE f.empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'id', v_emp.id,
    'codigo', v_emp.codigo,
    'nome', v_emp.nome,
    'logo_url', v_emp.logo_url,
    'campanha_codigo', v_campanha_codigo,
    'setores', v_setores,
    'funcoes', v_funcoes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_empresa_publica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_empresa_publica(text) TO anon, authenticated;

ALTER FUNCTION public.normalize_cargo_nome(text) SET search_path = public;

DROP POLICY IF EXISTS "Auth upload logo" ON storage.objects;
DROP POLICY IF EXISTS "Auth update logo" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete logo" ON storage.objects;

CREATE POLICY "Empresa logo upload scoped"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'empresa-logos'
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE lower(e.codigo) = (storage.foldername(name))[1]
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (public.has_role(auth.uid(), 'consultor'::public.app_role) AND e.owner_user_id = auth.uid())
        OR (public.has_role(auth.uid(), 'empresa'::public.app_role) AND e.id = public.current_user_empresa_id())
      )
  )
);

CREATE POLICY "Empresa logo update scoped"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'empresa-logos'
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE lower(e.codigo) = (storage.foldername(name))[1]
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (public.has_role(auth.uid(), 'consultor'::public.app_role) AND e.owner_user_id = auth.uid())
        OR (public.has_role(auth.uid(), 'empresa'::public.app_role) AND e.id = public.current_user_empresa_id())
      )
  )
);

CREATE POLICY "Empresa logo delete scoped"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'empresa-logos'
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE lower(e.codigo) = (storage.foldername(name))[1]
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR (public.has_role(auth.uid(), 'consultor'::public.app_role) AND e.owner_user_id = auth.uid())
        OR (public.has_role(auth.uid(), 'empresa'::public.app_role) AND e.id = public.current_user_empresa_id())
      )
  )
);

REVOKE EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, public.profile_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inserir_resposta_admin(text, text, text, jsonb, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_empresa_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_plan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_account_type() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_profile_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gerar_link_assinado(text, integer) FROM PUBLIC, anon;
