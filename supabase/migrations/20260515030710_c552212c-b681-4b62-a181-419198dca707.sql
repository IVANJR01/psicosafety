-- ========================================
-- 1) Cofre interno para segredos da aplicação
-- ========================================
CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy: nada é legível por roles normais (apenas SECURITY DEFINER).

-- Seed do segredo de assinatura (só insere se não existir)
INSERT INTO public.app_secrets (key, value)
VALUES ('link_signing_secret', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 2) Helper interno (não exposto a clients)
-- ========================================
CREATE OR REPLACE FUNCTION public._get_secret(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_secrets WHERE key = p_key LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._get_secret(text) FROM PUBLIC, anon, authenticated;

-- ========================================
-- 3) Gerar link assinado (admin only)
-- ========================================
CREATE OR REPLACE FUNCTION public.gerar_link_assinado(
  p_codigo text,
  p_validade_dias integer DEFAULT 7
)
RETURNS TABLE(exp bigint, sig text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_exp bigint;
  v_payload text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RAISE EXCEPTION 'codigo_invalido' USING ERRCODE = 'P0001';
  END IF;
  IF p_validade_dias <= 0 OR p_validade_dias > 365 THEN
    RAISE EXCEPTION 'validade_invalida' USING ERRCODE = 'P0001';
  END IF;
  v_secret := public._get_secret('link_signing_secret');
  v_exp := (extract(epoch from (now() + (p_validade_dias || ' days')::interval)) * 1000)::bigint;
  v_payload := lower(trim(p_codigo)) || '|' || v_exp::text;
  RETURN QUERY SELECT
    v_exp,
    encode(extensions.hmac(v_payload::bytea, v_secret::bytea, 'sha256'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_link_assinado(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_link_assinado(text, integer) TO authenticated;

-- ========================================
-- 4) Submissão com assinatura HMAC verificada no servidor
-- ========================================
CREATE OR REPLACE FUNCTION public.submeter_resposta_assinada(
  p_codigo text,
  p_exp bigint,
  p_sig text,
  p_setor text,
  p_funcao text,
  p_answers jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_payload text;
  v_expected text;
  v_empresa_id uuid;
  v_nome text;
  v_id uuid;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RAISE EXCEPTION 'codigo_invalido' USING ERRCODE = 'P0001';
  END IF;
  IF p_exp IS NULL OR p_sig IS NULL OR length(p_sig) <> 64 THEN
    RAISE EXCEPTION 'assinatura_invalida' USING ERRCODE = 'P0001';
  END IF;
  IF p_exp < (extract(epoch from now()) * 1000)::bigint THEN
    RAISE EXCEPTION 'link_expirado' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'answers_invalidas' USING ERRCODE = 'P0001';
  END IF;

  v_secret := public._get_secret('link_signing_secret');
  v_payload := lower(trim(p_codigo)) || '|' || p_exp::text;
  v_expected := encode(extensions.hmac(v_payload::bytea, v_secret::bytea, 'sha256'), 'hex');

  IF v_expected <> lower(p_sig) THEN
    RAISE EXCEPTION 'assinatura_invalida' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, nome INTO v_empresa_id, v_nome
  FROM public.empresas
  WHERE lower(codigo) = lower(trim(p_codigo))
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_encontrada' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.respostas (empresa_id, codigo_empresa, nome_empresa, setor, funcao, answers)
  VALUES (
    v_empresa_id, trim(p_codigo), v_nome,
    NULLIF(trim(coalesce(p_setor, '')), ''),
    NULLIF(trim(coalesce(p_funcao, '')), ''),
    p_answers
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submeter_resposta_assinada(text, bigint, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submeter_resposta_assinada(text, bigint, text, text, text, jsonb) TO anon, authenticated;

-- ========================================
-- 5) Auditoria de acesso a denúncias
-- ========================================
CREATE TABLE IF NOT EXISTS public.denuncia_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL,
  user_id uuid,
  user_email text,
  acao text NOT NULL DEFAULT 'view',
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denuncia_acessos_denuncia ON public.denuncia_acessos(denuncia_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_denuncia_acessos_user ON public.denuncia_acessos(user_id, created_at DESC);

ALTER TABLE public.denuncia_acessos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read denuncia acessos" ON public.denuncia_acessos;
CREATE POLICY "Admins read denuncia acessos"
ON public.denuncia_acessos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert apenas via RPC (sem policy de INSERT direto).

CREATE OR REPLACE FUNCTION public.registrar_acesso_denuncia(
  p_denuncia_id uuid,
  p_acao text DEFAULT 'view',
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'tecnico'::app_role)) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;
  SELECT email INTO v_email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.denuncia_acessos (denuncia_id, user_id, user_email, acao, ip, user_agent)
  VALUES (p_denuncia_id, auth.uid(), v_email, COALESCE(p_acao, 'view'),
          NULLIF(trim(coalesce(p_ip, '')), ''),
          NULLIF(trim(coalesce(p_user_agent, '')), ''));
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acesso_denuncia(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso_denuncia(uuid, text, text, text) TO authenticated;

-- ========================================
-- 6) Import histórico de respostas (admin)
-- ========================================
CREATE OR REPLACE FUNCTION public.inserir_resposta_admin(
  p_codigo text,
  p_setor text,
  p_funcao text,
  p_answers jsonb,
  p_created_at timestamptz DEFAULT NULL
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
  v_when timestamptz := COALESCE(p_created_at, now());
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'answers_invalidas' USING ERRCODE = 'P0001';
  END IF;
  SELECT id, nome INTO v_empresa_id, v_nome
  FROM public.empresas WHERE lower(codigo) = lower(trim(p_codigo)) LIMIT 1;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_nao_encontrada' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.respostas (empresa_id, codigo_empresa, nome_empresa, setor, funcao, answers, created_at)
  VALUES (
    v_empresa_id, trim(p_codigo), v_nome,
    NULLIF(trim(coalesce(p_setor, '')), ''),
    NULLIF(trim(coalesce(p_funcao, '')), ''),
    p_answers, v_when
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.inserir_resposta_admin(text, text, text, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inserir_resposta_admin(text, text, text, jsonb, timestamptz) TO authenticated;