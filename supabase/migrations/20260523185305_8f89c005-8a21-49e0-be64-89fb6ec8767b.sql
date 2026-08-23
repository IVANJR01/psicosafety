ALTER TABLE public.empresa_funcoes
  DROP CONSTRAINT IF EXISTS empresa_funcoes_empresa_id_nome_key;

DROP INDEX IF EXISTS public.empresa_funcoes_empresa_id_nome_key;

CREATE UNIQUE INDEX IF NOT EXISTS empresa_funcoes_unq_nome
ON public.empresa_funcoes (
  empresa_id,
  COALESCE(setor_id::text,'__none__'),
  public.normalize_cargo_nome(nome)
);