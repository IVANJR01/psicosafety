REVOKE EXECUTE ON FUNCTION public.unificar_setores(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_unificar_setores(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unificar_setores(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_unificar_setores(uuid, uuid) TO authenticated, service_role;