-- Novos cadastros de consultor/empresa_direta entram como 'pending' (aguardando liberação do super admin).
-- Admin (seed) continua entrando como 'active' automaticamente.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_seed_admin BOOLEAN := lower(NEW.email) = 'ivanjr.tstconsultoria@gmail.com';
  v_account_type account_type;
  v_plan_id uuid;
  v_status profile_status;
BEGIN
  v_account_type := COALESCE(
    (NEW.raw_user_meta_data->>'account_type')::account_type,
    'empresa_direta'::account_type
  );
  IF is_seed_admin THEN v_account_type := 'admin'::account_type; END IF;

  SELECT id INTO v_plan_id FROM public.plans
  WHERE tipo = v_account_type AND ativo = true
  ORDER BY preco_mensal ASC LIMIT 1;

  -- admin já entra ativo; demais ficam pendentes aguardando aprovação manual
  IF is_seed_admin OR v_account_type = 'admin' THEN
    v_status := 'active'::profile_status;
  ELSE
    v_status := 'pending'::profile_status;
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name, status, account_type, plan_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_status, v_account_type, v_plan_id
  );

  IF is_seed_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSIF v_account_type = 'consultor' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consultor') ON CONFLICT DO NOTHING;
  ELSIF v_account_type = 'empresa_direta' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'empresa') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Helper para o app verificar status do usuário corrente sem expor profiles inteiro
CREATE OR REPLACE FUNCTION public.current_profile_status()
 RETURNS profile_status
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$ SELECT status FROM public.profiles WHERE user_id = auth.uid() LIMIT 1 $$;

-- Função para super admin trocar plano de um cliente
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(p_user_id uuid, p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.profiles SET plan_id = p_plan_id, updated_at = now() WHERE user_id = p_user_id;
END;
$$;

-- Função para super admin alterar status (active/pending) de um cliente
CREATE OR REPLACE FUNCTION public.admin_set_user_status(p_user_id uuid, p_status profile_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'permissao_negada' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.profiles SET status = p_status, updated_at = now() WHERE user_id = p_user_id;
END;
$$;