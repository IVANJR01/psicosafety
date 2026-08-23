
-- Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Tighten anonymous insert on respostas (no longer "always true")
DROP POLICY IF EXISTS "Anyone can submit respostas" ON public.respostas;
CREATE POLICY "Anyone can submit respostas" ON public.respostas
  FOR INSERT
  WITH CHECK (
    char_length(codigo_empresa) BETWEEN 1 AND 64
    AND char_length(nome_empresa) BETWEEN 1 AND 200
    AND jsonb_typeof(answers) = 'object'
    AND (setor IS NULL OR char_length(setor) <= 120)
    AND (funcao IS NULL OR char_length(funcao) <= 120)
  );
