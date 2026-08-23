
-- =========================================
-- 1) RPC pública: submeter resposta do questionário
-- =========================================
CREATE OR REPLACE FUNCTION public.submeter_resposta_publica(
  p_codigo text,
  p_setor text,
  p_funcao text,
  p_answers jsonb,
  p_exp bigint DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_nome text;
  v_id uuid;
BEGIN
  -- valida expiração no servidor (millis since epoch)
  IF p_exp IS NOT NULL AND p_exp > 0 AND (p_exp < (extract(epoch from now()) * 1000)::bigint) THEN
    RAISE EXCEPTION 'link_expirado' USING ERRCODE = 'P0001';
  END IF;

  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RAISE EXCEPTION 'codigo_invalido' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'answers_invalidas' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, nome INTO v_empresa_id, v_nome
  FROM public.empresas
  WHERE lower(codigo) = lower(trim(p_codigo))
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_encontrada' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.respostas (
    empresa_id, codigo_empresa, nome_empresa, setor, funcao, answers
  ) VALUES (
    v_empresa_id,
    trim(p_codigo),
    v_nome,
    NULLIF(trim(coalesce(p_setor, '')), ''),
    NULLIF(trim(coalesce(p_funcao, '')), ''),
    p_answers
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submeter_resposta_publica(text, text, text, jsonb, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submeter_resposta_publica(text, text, text, jsonb, bigint) TO anon, authenticated;

-- =========================================
-- 2) RPC pública: consultar denúncia por protocolo + token
-- =========================================
CREATE OR REPLACE FUNCTION public.consultar_denuncia_publica(
  p_protocolo text,
  p_token text
)
RETURNS TABLE (
  protocolo text,
  categoria text,
  descricao text,
  setor text,
  status text,
  parecer text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.protocolo, d.categoria, d.descricao, d.setor, d.status, d.parecer, d.created_at, d.updated_at
  FROM public.denuncias d
  WHERE upper(trim(d.protocolo)) = upper(trim(p_protocolo))
    AND d.consulta_token = trim(p_token)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.consultar_denuncia_publica(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_denuncia_publica(text, text) TO anon, authenticated;

-- =========================================
-- 3) Policies UPDATE faltantes (auditoria item 7)
-- =========================================
CREATE POLICY "Admins update funcoes"
  ON public.empresa_funcoes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update setores"
  ON public.empresa_setores
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
