
-- 1) Trigger: se setor preenchido, função é obrigatória
CREATE OR REPLACE FUNCTION public.respostas_validar_funcao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.setor IS NOT NULL AND length(trim(NEW.setor)) > 0
     AND (NEW.funcao IS NULL OR length(trim(NEW.funcao)) = 0) THEN
    RAISE EXCEPTION 'funcao_obrigatoria' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_respostas_validar_funcao ON public.respostas;
CREATE TRIGGER trg_respostas_validar_funcao
BEFORE INSERT OR UPDATE OF setor, funcao ON public.respostas
FOR EACH ROW EXECUTE FUNCTION public.respostas_validar_funcao();

-- 2) RPC admin/consultor para corrigir função de uma resposta
CREATE OR REPLACE FUNCTION public.atualizar_funcao_resposta(p_id uuid, p_funcao text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_consultor boolean := public.has_role(auth.uid(), 'consultor'::app_role);
  v_owns boolean := false;
BEGIN
  IF p_funcao IS NULL OR length(trim(p_funcao)) = 0 THEN
    RAISE EXCEPTION 'funcao_obrigatoria' USING ERRCODE = 'P0001';
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
  UPDATE public.respostas SET funcao = trim(p_funcao) WHERE id = p_id;
END;
$$;
