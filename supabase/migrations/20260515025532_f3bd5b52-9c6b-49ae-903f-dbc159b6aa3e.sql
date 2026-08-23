
-- ===== Tabela campanhas =====
CREATE TABLE IF NOT EXISTS public.campanhas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(nome) BETWEEN 1 AND 200),
  CHECK (char_length(codigo) BETWEEN 1 AND 64),
  CHECK (fim IS NULL OR fim > inicio)
);

CREATE INDEX IF NOT EXISTS idx_campanhas_empresa ON public.campanhas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_ativa ON public.campanhas(ativa);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads campanhas"
  ON public.campanhas FOR SELECT TO public USING (true);

CREATE POLICY "Admins insert campanhas"
  ON public.campanhas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update campanhas"
  ON public.campanhas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete campanhas"
  ON public.campanhas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- trigger updated_at
DROP TRIGGER IF EXISTS trg_campanhas_updated_at ON public.campanhas;
CREATE TRIGGER trg_campanhas_updated_at
  BEFORE UPDATE ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Vincular respostas a campanha =====
ALTER TABLE public.respostas
  ADD COLUMN IF NOT EXISTS campanha_id uuid NULL
    REFERENCES public.campanhas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_respostas_campanha ON public.respostas(campanha_id);

-- ===== Seed: cria campanha "Padrão" ativa para cada empresa, reutilizando o código =====
INSERT INTO public.campanhas (empresa_id, nome, codigo, inicio, fim, ativa)
SELECT e.id, 'Campanha Padrão', e.codigo, now(), NULL, true
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.campanhas c WHERE c.empresa_id = e.id
)
ON CONFLICT (codigo) DO NOTHING;

-- ===== RPC pública: submeter resposta por código de campanha =====
CREATE OR REPLACE FUNCTION public.submeter_resposta_campanha(
  p_codigo text,
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
  v_camp record;
  v_empresa_nome text;
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

  IF v_camp.id IS NULL THEN
    RAISE EXCEPTION 'campanha_nao_encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_camp.ativa THEN
    RAISE EXCEPTION 'campanha_inativa' USING ERRCODE = 'P0001';
  END IF;

  IF v_camp.inicio > now() THEN
    RAISE EXCEPTION 'campanha_nao_iniciada' USING ERRCODE = 'P0001';
  END IF;

  IF v_camp.fim IS NOT NULL AND v_camp.fim < now() THEN
    RAISE EXCEPTION 'campanha_encerrada' USING ERRCODE = 'P0001';
  END IF;

  SELECT nome INTO v_empresa_nome FROM public.empresas WHERE id = v_camp.empresa_id;

  INSERT INTO public.respostas (
    empresa_id, codigo_empresa, nome_empresa, setor, funcao, answers, campanha_id
  ) VALUES (
    v_camp.empresa_id,
    trim(p_codigo),
    v_empresa_nome,
    NULLIF(trim(coalesce(p_setor, '')), ''),
    NULLIF(trim(coalesce(p_funcao, '')), ''),
    p_answers,
    v_camp.id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submeter_resposta_campanha(text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submeter_resposta_campanha(text, text, text, jsonb) TO anon, authenticated;
