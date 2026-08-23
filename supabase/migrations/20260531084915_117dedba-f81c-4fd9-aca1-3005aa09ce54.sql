ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cnae text,
  ADD COLUMN IF NOT EXISTS grau_risco text,
  ADD COLUMN IF NOT EXISTS num_trabalhadores integer,
  ADD COLUMN IF NOT EXISTS resp_formacao text;