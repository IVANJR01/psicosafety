ALTER TABLE public.empresa_setores
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS merged_into_sector_id uuid NULL REFERENCES public.empresa_setores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS merged_by uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'empresa_setores_status_check'
      AND conrelid = 'public.empresa_setores'::regclass
  ) THEN
    ALTER TABLE public.empresa_setores
      ADD CONSTRAINT empresa_setores_status_check CHECK (status IN ('active', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_empresa_setores_status
  ON public.empresa_setores(empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_empresa_setores_merged_into
  ON public.empresa_setores(merged_into_sector_id);

CREATE TABLE IF NOT EXISTS public.setor_merge_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  origem_setor_id uuid NOT NULL REFERENCES public.empresa_setores(id) ON DELETE RESTRICT,
  destino_setor_id uuid NOT NULL REFERENCES public.empresa_setores(id) ON DELETE RESTRICT,
  origem_nome text NOT NULL,
  origem_ges text NULL,
  destino_nome text NOT NULL,
  destino_ges text NULL,
  actor_user_id uuid NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.setor_merge_history TO authenticated;
GRANT ALL ON public.setor_merge_history TO service_role;

ALTER TABLE public.setor_merge_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read setor merge history" ON public.setor_merge_history;
DROP POLICY IF EXISTS "Consultores can read own setor merge history" ON public.setor_merge_history;

CREATE POLICY "Admins can read setor merge history"
ON public.setor_merge_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Consultores can read own setor merge history"
ON public.setor_merge_history
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'consultor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = setor_merge_history.empresa_id
      AND e.owner_user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.unificar_setores(p_origem uuid, p_destino uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_o public.empresa_setores%ROWTYPE;
  v_d public.empresa_setores%ROWTYPE;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_consultor boolean := public.has_role(auth.uid(), 'consultor'::app_role);
  v_owner uuid;
  v_funcoes_mov int := 0;
  v_funcoes_arch int := 0;
  v_camp_mov int := 0;
  v_camp_del int := 0;
  v_resp_mov int := 0;
  v_hist_id uuid;
  v_summary jsonb;
BEGIN
  IF p_origem = p_destino THEN
    RAISE EXCEPTION 'setores_iguais' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_o FROM public.empresa_setores WHERE id = p_origem FOR UPDATE;
  SELECT * INTO v_d FROM public.empresa_setores WHERE id = p_destino FOR UPDATE;

  IF v_o.id IS NULL OR v_d.id IS NULL THEN
    RAISE EXCEPTION 'setor_nao_encontrado' USING ERRCODE = 'P0001';
  END IF;
  IF v_o.empresa_id <> v_d.empresa_id THEN
    RAISE EXCEPTION 'empresas_diferentes' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_d.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'destino_arquivado' USING ERRCODE = 'P0001';
  END IF;

  SELECT owner_user_id INTO v_owner FROM public.empresas WHERE id = v_o.empresa_id;
  IF NOT (v_is_admin OR (v_is_consultor AND v_owner = auth.uid())) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;

  -- Cargos/funções duplicados: remover primeiro os cargos da origem que já têm equivalente no destino.
  -- Isso evita violar os índices únicos quando os demais cargos forem movidos.
  WITH duplicated AS (
    SELECT f.id
    FROM public.empresa_funcoes f
    WHERE f.empresa_id = v_o.empresa_id
      AND f.setor_id = p_origem
      AND EXISTS (
        SELECT 1
        FROM public.empresa_funcoes fd
        WHERE fd.empresa_id = f.empresa_id
          AND fd.setor_id = p_destino
          AND (
            lower(trim(fd.nome)) = lower(trim(f.nome))
            OR public.normalize_cargo_nome(fd.nome) = public.normalize_cargo_nome(f.nome)
          )
      )
  ), del AS (
    DELETE FROM public.empresa_funcoes f
    USING duplicated d
    WHERE f.id = d.id
    RETURNING 1
  )
  SELECT count(*) INTO v_funcoes_arch FROM del;

  -- Cargos não duplicados são migrados para o setor correto.
  WITH upd AS (
    UPDATE public.empresa_funcoes f
       SET setor_id = p_destino
     WHERE f.empresa_id = v_o.empresa_id
       AND f.setor_id = p_origem
     RETURNING 1
  )
  SELECT count(*) INTO v_funcoes_mov FROM upd;

  -- Campaign sectors: se a campanha já contém o destino, remove o vínculo duplicado da origem.
  WITH del AS (
    DELETE FROM public.campaign_sectors cs
     WHERE cs.setor_id = p_origem
       AND EXISTS (
         SELECT 1
         FROM public.campaign_sectors cs2
         WHERE cs2.campaign_id = cs.campaign_id
           AND cs2.setor_id = p_destino
       )
     RETURNING 1
  )
  SELECT count(*) INTO v_camp_del FROM del;

  WITH upd AS (
    UPDATE public.campaign_sectors
       SET setor_id = p_destino
     WHERE setor_id = p_origem
     RETURNING 1
  )
  SELECT count(*) INTO v_camp_mov FROM upd;

  -- Respostas históricas usam texto do setor; renomeia para o nome correto para manter relatórios agregados.
  WITH upd AS (
    UPDATE public.respostas
       SET setor = v_d.nome
     WHERE empresa_id = v_o.empresa_id
       AND lower(trim(coalesce(setor,''))) = lower(trim(v_o.nome))
     RETURNING 1
  )
  SELECT count(*) INTO v_resp_mov FROM upd;

  -- Não apagar fisicamente: arquiva o setor de origem e registra destino.
  UPDATE public.empresa_setores
     SET status = 'archived',
         merged_into_sector_id = p_destino,
         merged_at = now(),
         merged_by = auth.uid()
   WHERE id = p_origem;

  v_summary := jsonb_build_object(
    'funcoes_migradas', v_funcoes_mov,
    'funcoes_duplicadas_removidas', v_funcoes_arch,
    'campanhas_migradas', v_camp_mov,
    'campanhas_duplicadas_removidas', v_camp_del,
    'respostas_renomeadas', v_resp_mov,
    'origem_arquivada', true,
    'destino', jsonb_build_object('id', v_d.id, 'nome', v_d.nome, 'ges', v_d.ges)
  );

  INSERT INTO public.setor_merge_history (
    empresa_id, origem_setor_id, destino_setor_id,
    origem_nome, origem_ges, destino_nome, destino_ges,
    actor_user_id, summary, message
  ) VALUES (
    v_o.empresa_id, v_o.id, v_d.id,
    v_o.nome, v_o.ges, v_d.nome, v_d.ges,
    auth.uid(), v_summary,
    'Setor ' || v_o.nome || COALESCE(' — GES ' || v_o.ges, '') ||
    ' foi unificado ao setor ' || v_d.nome || COALESCE(' — GES ' || v_d.ges, '') ||
    ' em ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || '.'
  ) RETURNING id INTO v_hist_id;

  RETURN v_summary || jsonb_build_object('historico_id', v_hist_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_unificar_setores(p_origem uuid, p_destino uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_o public.empresa_setores%ROWTYPE;
  v_d public.empresa_setores%ROWTYPE;
  v_funcoes int := 0;
  v_funcoes_dup int := 0;
  v_camp int := 0;
  v_camp_dup int := 0;
  v_resp int := 0;
BEGIN
  SELECT * INTO v_o FROM public.empresa_setores WHERE id = p_origem;
  SELECT * INTO v_d FROM public.empresa_setores WHERE id = p_destino;
  IF v_o.id IS NULL OR v_d.id IS NULL THEN
    RETURN jsonb_build_object('erro','setor_nao_encontrado');
  END IF;
  IF v_o.empresa_id <> v_d.empresa_id THEN
    RETURN jsonb_build_object('erro','empresas_diferentes');
  END IF;

  SELECT count(*) INTO v_funcoes
    FROM public.empresa_funcoes
   WHERE setor_id = p_origem;

  SELECT count(*) INTO v_funcoes_dup
    FROM public.empresa_funcoes f
   WHERE f.empresa_id = v_o.empresa_id
     AND f.setor_id = p_origem
     AND EXISTS (
       SELECT 1
       FROM public.empresa_funcoes fd
       WHERE fd.empresa_id = f.empresa_id
         AND fd.setor_id = p_destino
         AND (
           lower(trim(fd.nome)) = lower(trim(f.nome))
           OR public.normalize_cargo_nome(fd.nome) = public.normalize_cargo_nome(f.nome)
         )
     );

  SELECT count(*) INTO v_camp
    FROM public.campaign_sectors
   WHERE setor_id = p_origem;

  SELECT count(*) INTO v_camp_dup
    FROM public.campaign_sectors cs
   WHERE cs.setor_id = p_origem
     AND EXISTS (
       SELECT 1 FROM public.campaign_sectors cs2
       WHERE cs2.campaign_id = cs.campaign_id
         AND cs2.setor_id = p_destino
     );

  SELECT count(*) INTO v_resp
    FROM public.respostas
   WHERE empresa_id = v_o.empresa_id
     AND lower(trim(coalesce(setor,''))) = lower(trim(v_o.nome));

  RETURN jsonb_build_object(
    'origem', jsonb_build_object('id',v_o.id,'nome',v_o.nome,'ges',v_o.ges,'status',v_o.status),
    'destino', jsonb_build_object('id',v_d.id,'nome',v_d.nome,'ges',v_d.ges,'status',v_d.status),
    'funcoes', v_funcoes,
    'funcoes_duplicadas', v_funcoes_dup,
    'funcoes_a_migrar', greatest(v_funcoes - v_funcoes_dup, 0),
    'campanhas', v_camp,
    'campaign_sectors', v_camp,
    'campaign_sectors_duplicados', v_camp_dup,
    'respostas', v_resp,
    'avaliacoes', v_resp,
    'relatorios', v_resp,
    'origem_sera_arquivada', true
  );
END;
$function$;

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

  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE lower(codigo) = lower(p_codigo)
  LIMIT 1;

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
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'ges', s.ges) ORDER BY s.nome), '[]'::jsonb)
      INTO v_setores
      FROM public.empresa_setores s
      JOIN public.campaign_sectors cs ON cs.setor_id = s.id
      WHERE cs.campaign_id = v_campanha_id
        AND COALESCE(s.status, 'active') = 'active';

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'setor_id', f.setor_id) ORDER BY f.nome), '[]'::jsonb)
      INTO v_funcoes
      FROM public.empresa_funcoes f
      WHERE f.empresa_id = v_empresa_id
        AND (
          f.setor_id IS NULL
          OR f.setor_id IN (
            SELECT cs.setor_id
            FROM public.campaign_sectors cs
            JOIN public.empresa_setores s ON s.id = cs.setor_id
            WHERE cs.campaign_id = v_campanha_id
              AND COALESCE(s.status, 'active') = 'active'
          )
        );
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'ges', s.ges) ORDER BY s.nome), '[]'::jsonb)
      INTO v_setores
      FROM public.empresa_setores s
      WHERE s.empresa_id = v_empresa_id
        AND COALESCE(s.status, 'active') = 'active';

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'setor_id', f.setor_id) ORDER BY f.nome), '[]'::jsonb)
      INTO v_funcoes
      FROM public.empresa_funcoes f
      LEFT JOIN public.empresa_setores s ON s.id = f.setor_id
      WHERE f.empresa_id = v_empresa_id
        AND (f.setor_id IS NULL OR COALESCE(s.status, 'active') = 'active');
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