-- Função de normalização do nome do cargo
CREATE OR REPLACE FUNCTION public.normalize_cargo_nome(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(trim(coalesce(p,'')), '[[:punct:][:space:]]+$', ''))
$$;

-- Remove duplicatas existentes (mantém o id mais antigo por created_at, fallback id)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY empresa_id, COALESCE(setor_id::text,'__none__'), public.normalize_cargo_nome(nome)
           ORDER BY created_at NULLS LAST, id
         ) AS rn
  FROM public.empresa_funcoes
)
DELETE FROM public.empresa_funcoes f
USING ranked r
WHERE f.id = r.id AND r.rn > 1;

-- Índice único impedindo duplicação futura
CREATE UNIQUE INDEX IF NOT EXISTS empresa_funcoes_unq_nome
ON public.empresa_funcoes (
  empresa_id,
  COALESCE(setor_id::text,'__none__'),
  public.normalize_cargo_nome(nome)
);