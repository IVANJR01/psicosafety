
-- Adiciona campos de dados básicos
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_cargo text;

-- Bucket público para logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresa-logos', 'empresa-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket
DROP POLICY IF EXISTS "Logos publicos leitura" ON storage.objects;
CREATE POLICY "Logos publicos leitura"
ON storage.objects FOR SELECT
USING (bucket_id = 'empresa-logos');

DROP POLICY IF EXISTS "Auth upload logo" ON storage.objects;
CREATE POLICY "Auth upload logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'empresa-logos');

DROP POLICY IF EXISTS "Auth update logo" ON storage.objects;
CREATE POLICY "Auth update logo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'empresa-logos');

DROP POLICY IF EXISTS "Auth delete logo" ON storage.objects;
CREATE POLICY "Auth delete logo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'empresa-logos');
