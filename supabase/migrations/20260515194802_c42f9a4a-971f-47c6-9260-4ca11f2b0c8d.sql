
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
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RAISE EXCEPTION 'codigo_invalido' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'answers_invalidas' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.id, c.empresa_id, c.ativa, c.inicio, c.fim
    INTO v_camp
  FROM public.campanhas c
  WHERE lower(c.codigo) = lower(trim(p_codigo))
  LIMIT 1;

  IF v_camp.id IS NULL THEN RAISE EXCEPTION 'campanha_nao_encontrada' USING ERRCODE = 'P0001'; END IF;
  IF NOT v_camp.ativa THEN RAISE EXCEPTION 'campanha_inativa' USING ERRCODE = 'P0001'; END IF;
  IF v_camp.inicio > now() THEN RAISE EXCEPTION 'campanha_nao_iniciada' USING ERRCODE = 'P0001'; END IF;
  IF v_camp.fim IS NOT NULL AND v_camp.fim < now() THEN RAISE EXCEPTION 'campanha_encerrada' USING ERRCODE = 'P0001'; END IF;

  SELECT codigo, nome INTO v_empresa FROM public.empresas WHERE id = v_camp.empresa_id;

  INSERT INTO public.respostas (
    empresa_id, codigo_empresa, nome_empresa, setor, funcao, answers, campanha_id
  ) VALUES (
    v_camp.empresa_id,
    v_empresa.codigo,
    v_empresa.nome,
    NULLIF(trim(coalesce(p_setor, '')), ''),
    NULLIF(trim(coalesce(p_funcao, '')), ''),
    p_answers,
    v_camp.id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Corrige respostas existentes que salvaram o código da campanha
UPDATE public.respostas r
SET codigo_empresa = e.codigo,
    nome_empresa = e.nome
FROM public.empresas e
WHERE r.empresa_id = e.id
  AND r.codigo_empresa <> e.codigo;
