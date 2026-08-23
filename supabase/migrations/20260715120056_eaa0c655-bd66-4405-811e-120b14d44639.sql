
CREATE OR REPLACE FUNCTION public.get_empresa_publica(p_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_campanha_id uuid := NULL;
  v_campanha_codigo text := NULL;
  v_scope_mode text := 'all_sectors';
  v_emp public.empresas%ROWTYPE;
  v_setores jsonb;
  v_funcoes jsonb;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_empresa_id FROM public.empresas WHERE lower(codigo) = lower(p_codigo) LIMIT 1;

  IF v_empresa_id IS NULL THEN
    SELECT c.empresa_id, c.id, c.codigo, COALESCE(c.scope_mode::text, 'all_sectors')
      INTO v_empresa_id, v_campanha_id, v_campanha_codigo, v_scope_mode
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

  IF v_campanha_id IS NOT NULL AND v_scope_mode = 'selected_sectors' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) ORDER BY s.nome), '[]'::jsonb)
      INTO v_setores
      FROM public.empresa_setores s
      JOIN public.campaign_sectors cs ON cs.setor_id = s.id
      WHERE cs.campaign_id = v_campanha_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'setor_id', f.setor_id) ORDER BY f.nome), '[]'::jsonb)
      INTO v_funcoes
      FROM public.empresa_funcoes f
      WHERE f.empresa_id = v_empresa_id
        AND (f.setor_id IS NULL OR f.setor_id IN (SELECT setor_id FROM public.campaign_sectors WHERE campaign_id = v_campanha_id));
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) ORDER BY s.nome), '[]'::jsonb)
      INTO v_setores
      FROM public.empresa_setores s WHERE s.empresa_id = v_empresa_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'setor_id', f.setor_id) ORDER BY f.nome), '[]'::jsonb)
      INTO v_funcoes
      FROM public.empresa_funcoes f WHERE f.empresa_id = v_empresa_id;
  END IF;

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
$function$;


CREATE OR REPLACE FUNCTION public.submeter_resposta_campanha(p_codigo text, p_setor text, p_funcao text, p_answers jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_camp record;
  v_empresa record;
  v_id uuid;
  v_setor_norm text := NULLIF(trim(coalesce(p_setor, '')), '');
  v_in_scope boolean;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RAISE EXCEPTION 'codigo_invalido' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'answers_invalidas' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.id, c.empresa_id, c.ativa, c.inicio, c.fim, COALESCE(c.scope_mode::text, 'all_sectors') AS scope_mode
    INTO v_camp
  FROM public.campanhas c
  WHERE lower(c.codigo) = lower(trim(p_codigo))
  LIMIT 1;

  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'campanha_nao_encontrada' USING ERRCODE = 'P0001'; END IF;
  IF NOT v_camp.ativa THEN RAISE EXCEPTION 'campanha_inativa' USING ERRCODE = 'P0001'; END IF;
  IF v_camp.inicio > now() THEN RAISE EXCEPTION 'campanha_nao_iniciada' USING ERRCODE = 'P0001'; END IF;
  IF v_camp.fim IS NOT NULL AND v_camp.fim < now() THEN RAISE EXCEPTION 'campanha_encerrada' USING ERRCODE = 'P0001'; END IF;

  IF v_camp.scope_mode = 'selected_sectors' THEN
    IF v_setor_norm IS NULL THEN
      RAISE EXCEPTION 'setor_fora_do_escopo' USING ERRCODE = 'P0001';
    END IF;
    SELECT EXISTS (
      SELECT 1
      FROM public.campaign_sectors cs
      JOIN public.empresa_setores s ON s.id = cs.setor_id
      WHERE cs.campaign_id = v_camp.id
        AND lower(trim(s.nome)) = lower(v_setor_norm)
    ) INTO v_in_scope;
    IF NOT v_in_scope THEN
      RAISE EXCEPTION 'setor_fora_do_escopo' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT codigo, nome INTO v_empresa FROM public.empresas WHERE id = v_camp.empresa_id;

  INSERT INTO public.respostas (
    empresa_id, codigo_empresa, nome_empresa, setor, funcao, answers, campanha_id
  ) VALUES (
    v_camp.empresa_id,
    v_empresa.codigo,
    v_empresa.nome,
    v_setor_norm,
    NULLIF(trim(coalesce(p_funcao, '')), ''),
    p_answers,
    v_camp.id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
