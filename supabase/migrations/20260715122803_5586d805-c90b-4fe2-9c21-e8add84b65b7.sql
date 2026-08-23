
CREATE OR REPLACE FUNCTION public.unificar_setores(p_origem uuid, p_destino uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_o public.empresa_setores%ROWTYPE;
  v_d public.empresa_setores%ROWTYPE;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_consultor boolean := public.has_role(auth.uid(), 'consultor'::app_role);
  v_owner uuid;
  v_funcoes_mov int := 0;
  v_funcoes_del int := 0;
  v_camp_mov int := 0;
  v_camp_del int := 0;
  v_resp_mov int := 0;
BEGIN
  IF p_origem = p_destino THEN
    RAISE EXCEPTION 'setores_iguais' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_o FROM public.empresa_setores WHERE id = p_origem;
  SELECT * INTO v_d FROM public.empresa_setores WHERE id = p_destino;
  IF v_o.id IS NULL OR v_d.id IS NULL THEN
    RAISE EXCEPTION 'setor_nao_encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_o.empresa_id <> v_d.empresa_id THEN
    RAISE EXCEPTION 'empresas_diferentes' USING ERRCODE = 'P0001';
  END IF;

  SELECT owner_user_id INTO v_owner FROM public.empresas WHERE id = v_o.empresa_id;
  IF NOT (v_is_admin OR (v_is_consultor AND v_owner = auth.uid())) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;

  -- Funções: deletar as que já existem no destino (mesmo nome normalizado), migrar as demais
  WITH del AS (
    DELETE FROM public.empresa_funcoes f
     WHERE f.setor_id = p_origem
       AND EXISTS (
         SELECT 1 FROM public.empresa_funcoes f2
          WHERE f2.empresa_id = f.empresa_id
            AND f2.setor_id = p_destino
            AND public.normalize_cargo_nome(f2.nome) = public.normalize_cargo_nome(f.nome)
       )
     RETURNING 1
  ) SELECT count(*) INTO v_funcoes_del FROM del;

  WITH upd AS (
    UPDATE public.empresa_funcoes SET setor_id = p_destino
     WHERE setor_id = p_origem
     RETURNING 1
  ) SELECT count(*) INTO v_funcoes_mov FROM upd;

  -- campaign_sectors
  WITH del AS (
    DELETE FROM public.campaign_sectors cs
     WHERE cs.setor_id = p_origem
       AND EXISTS (SELECT 1 FROM public.campaign_sectors cs2 WHERE cs2.campaign_id = cs.campaign_id AND cs2.setor_id = p_destino)
     RETURNING 1
  ) SELECT count(*) INTO v_camp_del FROM del;

  WITH upd AS (
    UPDATE public.campaign_sectors SET setor_id = p_destino
     WHERE setor_id = p_origem
     RETURNING 1
  ) SELECT count(*) INTO v_camp_mov FROM upd;

  -- Respostas (setor é texto): renomear pelo nome
  WITH upd AS (
    UPDATE public.respostas SET setor = v_d.nome
     WHERE empresa_id = v_o.empresa_id
       AND lower(trim(coalesce(setor,''))) = lower(trim(v_o.nome))
     RETURNING 1
  ) SELECT count(*) INTO v_resp_mov FROM upd;

  DELETE FROM public.empresa_setores WHERE id = p_origem;

  RETURN jsonb_build_object(
    'funcoes_migradas', v_funcoes_mov,
    'funcoes_removidas_duplicadas', v_funcoes_del,
    'campanhas_migradas', v_camp_mov,
    'campanhas_removidas_duplicadas', v_camp_del,
    'respostas_renomeadas', v_resp_mov,
    'destino', jsonb_build_object('id', v_d.id, 'nome', v_d.nome, 'ges', v_d.ges)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_unificar_setores(p_origem uuid, p_destino uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_o public.empresa_setores%ROWTYPE;
  v_d public.empresa_setores%ROWTYPE;
  v_funcoes int := 0;
  v_camp int := 0;
  v_resp int := 0;
BEGIN
  SELECT * INTO v_o FROM public.empresa_setores WHERE id = p_origem;
  SELECT * INTO v_d FROM public.empresa_setores WHERE id = p_destino;
  IF v_o.id IS NULL OR v_d.id IS NULL THEN
    RETURN jsonb_build_object('erro','setor_nao_encontrado');
  END IF;
  SELECT count(*) INTO v_funcoes FROM public.empresa_funcoes WHERE setor_id = p_origem;
  SELECT count(*) INTO v_camp FROM public.campaign_sectors WHERE setor_id = p_origem;
  SELECT count(*) INTO v_resp FROM public.respostas
   WHERE empresa_id = v_o.empresa_id
     AND lower(trim(coalesce(setor,''))) = lower(trim(v_o.nome));
  RETURN jsonb_build_object(
    'origem', jsonb_build_object('id',v_o.id,'nome',v_o.nome,'ges',v_o.ges),
    'destino', jsonb_build_object('id',v_d.id,'nome',v_d.nome,'ges',v_d.ges),
    'funcoes', v_funcoes,
    'campanhas', v_camp,
    'respostas', v_resp
  );
END;
$$;
