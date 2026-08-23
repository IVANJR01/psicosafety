
ALTER TABLE public.empresa_funcoes
  ADD COLUMN IF NOT EXISTS setor_id uuid NULL
    REFERENCES public.empresa_setores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_funcoes_setor
  ON public.empresa_funcoes(setor_id);

CREATE INDEX IF NOT EXISTS idx_empresa_funcoes_empresa
  ON public.empresa_funcoes(empresa_id);

-- Evita duplicar a mesma função no mesmo escopo (empresa + setor opcional)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_empresa_funcoes_nome_setor
  ON public.empresa_funcoes(empresa_id, COALESCE(setor_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));
