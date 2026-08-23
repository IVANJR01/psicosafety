
CREATE OR REPLACE FUNCTION public.atualizar_setor_resposta(p_id uuid, p_setor text, p_funcao text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_consultor boolean := public.has_role(auth.uid(), 'consultor'::app_role);
  v_owns boolean := false;
  v_setor text := NULLIF(trim(coalesce(p_setor, '')), '');
  v_funcao text := NULLIF(trim(coalesce(p_funcao, '')), '');
BEGIN
  IF v_setor IS NULL THEN
    RAISE EXCEPTION 'setor_obrigatorio' USING ERRCODE = 'P0001';
  END IF;
  SELECT empresa_id INTO v_empresa_id FROM public.respostas WHERE id = p_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'resposta_nao_encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_is_consultor THEN
    SELECT (owner_user_id = auth.uid()) INTO v_owns FROM public.empresas WHERE id = v_empresa_id;
  END IF;
  IF NOT (v_is_admin OR (v_is_consultor AND v_owns)) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.respostas
     SET setor = v_setor,
         funcao = COALESCE(v_funcao, funcao)
   WHERE id = p_id;
END;
$function$;
