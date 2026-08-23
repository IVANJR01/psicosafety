
-- Enum account_type
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('admin', 'consultor', 'empresa_direta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela plans
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo account_type NOT NULL,
  max_empresas int NOT NULL DEFAULT 1,
  max_avaliacoes int NOT NULL DEFAULT 50,
  preco_mensal numeric(10,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads plans" ON public.plans;
CREATE POLICY "Anyone reads plans" ON public.plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage plans" ON public.plans;
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.plans (nome, tipo, max_empresas, max_avaliacoes, preco_mensal) VALUES
  ('Consultor Starter', 'consultor', 5, 500, 297.00),
  ('Consultor Pro', 'consultor', 20, 3000, 697.00),
  ('Consultor Enterprise', 'consultor', 100, 20000, 1997.00),
  ('Empresa Essencial', 'empresa_direta', 1, 100, 197.00),
  ('Empresa Profissional', 'empresa_direta', 1, 500, 397.00),
  ('Empresa Corporativo', 'empresa_direta', 1, 5000, 897.00)
ON CONFLICT DO NOTHING;

-- profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type account_type NOT NULL DEFAULT 'empresa_direta';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id);
UPDATE public.profiles SET account_type = 'admin' WHERE lower(email) = 'ivanjr.tstconsultoria@gmail.com';

-- empresas owner
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS owner_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_empresas_owner ON public.empresas(owner_user_id);

-- helpers
CREATE OR REPLACE FUNCTION public.current_account_type()
RETURNS account_type LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT account_type FROM public.profiles WHERE user_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.current_user_plan()
RETURNS TABLE(plan_id uuid, nome text, tipo account_type, max_empresas int, max_avaliacoes int, preco_mensal numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.nome, p.tipo, p.max_empresas, p.max_avaliacoes, p.preco_mensal
  FROM public.profiles pr LEFT JOIN public.plans p ON p.id = pr.plan_id
  WHERE pr.user_id = auth.uid() LIMIT 1
$$;

-- RLS empresas
DROP POLICY IF EXISTS "Anyone can read empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admins manage empresas insert" ON public.empresas;
DROP POLICY IF EXISTS "Admins manage empresas update" ON public.empresas;
DROP POLICY IF EXISTS "Admins manage empresas delete" ON public.empresas;
DROP POLICY IF EXISTS "Read empresas scoped" ON public.empresas;
DROP POLICY IF EXISTS "Insert empresas" ON public.empresas;
DROP POLICY IF EXISTS "Update empresas" ON public.empresas;
DROP POLICY IF EXISTS "Delete empresas" ON public.empresas;

CREATE POLICY "Read empresas public" ON public.empresas FOR SELECT USING (true);
CREATE POLICY "Insert empresas" ON public.empresas FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'consultor'::app_role) AND owner_user_id = auth.uid())
);
CREATE POLICY "Update empresas" ON public.empresas FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'consultor'::app_role) AND owner_user_id = auth.uid())
);
CREATE POLICY "Delete empresas" ON public.empresas FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'consultor'::app_role) AND owner_user_id = auth.uid())
);

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  is_seed_admin BOOLEAN := lower(NEW.email) = 'ivanjr.tstconsultoria@gmail.com';
  v_account_type account_type;
  v_plan_id uuid;
BEGIN
  v_account_type := COALESCE(
    (NEW.raw_user_meta_data->>'account_type')::account_type,
    'empresa_direta'::account_type
  );
  IF is_seed_admin THEN v_account_type := 'admin'::account_type; END IF;

  SELECT id INTO v_plan_id FROM public.plans
  WHERE tipo = v_account_type AND ativo = true
  ORDER BY preco_mensal ASC LIMIT 1;

  INSERT INTO public.profiles (user_id, email, display_name, status, account_type, plan_id)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'active'::profile_status,
    v_account_type, v_plan_id
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
