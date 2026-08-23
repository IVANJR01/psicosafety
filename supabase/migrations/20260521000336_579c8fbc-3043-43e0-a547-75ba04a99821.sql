
-- Tabelas
create table if not exists public.questionario_dimensoes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  descricao text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questionario_perguntas (
  id uuid primary key default gen_random_uuid(),
  dimensao_id uuid not null references public.questionario_dimensoes(id) on delete cascade,
  codigo text not null unique,
  texto text not null,
  escala text not null default 'freq' check (escala in ('freq','grau','custom')),
  reverse boolean not null default false,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questionario_opcoes (
  id uuid primary key default gen_random_uuid(),
  pergunta_id uuid not null references public.questionario_perguntas(id) on delete cascade,
  valor int not null check (valor between 1 and 5),
  rotulo text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_qp_dim on public.questionario_perguntas(dimensao_id);
create index if not exists idx_qo_perg on public.questionario_opcoes(pergunta_id);

-- RLS
alter table public.questionario_dimensoes enable row level security;
alter table public.questionario_perguntas enable row level security;
alter table public.questionario_opcoes enable row level security;

create policy "Anyone reads dimensoes" on public.questionario_dimensoes for select to anon, authenticated using (true);
create policy "Admins manage dimensoes" on public.questionario_dimensoes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "Anyone reads perguntas" on public.questionario_perguntas for select to anon, authenticated using (true);
create policy "Admins manage perguntas" on public.questionario_perguntas for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "Anyone reads opcoes" on public.questionario_opcoes for select to anon, authenticated using (true);
create policy "Admins manage opcoes" on public.questionario_opcoes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Trigger updated_at
create trigger trg_qd_updated before update on public.questionario_dimensoes for each row execute function public.update_updated_at_column();
create trigger trg_qp_updated before update on public.questionario_perguntas for each row execute function public.update_updated_at_column();

-- SEED
insert into public.questionario_dimensoes (slug, titulo, descricao, ordem) values
  ('demandas','Demandas no trabalho','Carga, ritmo e exigências emocionais.',1),
  ('organizacao','Organização e conteúdo do trabalho','Autonomia, sentido e previsibilidade.',2),
  ('relacoes','Relações sociais e liderança','Apoio de colegas, chefia e clareza de papéis.',3),
  ('interface','Interface trabalho-indivíduo','Satisfação e conflito trabalho-vida.',4),
  ('saude','Saúde e bem-estar','Estresse, esgotamento e sono.',5),
  ('ofensivos','Comportamentos ofensivos','Assédio moral, sexual e violência no trabalho.',6)
on conflict (slug) do nothing;

-- Helper para inserir pergunta
do $$
declare
  v_dem uuid; v_org uuid; v_rel uuid; v_int uuid; v_sau uuid; v_ofe uuid;
  v_i1 uuid; v_s4 uuid;
begin
  select id into v_dem from public.questionario_dimensoes where slug='demandas';
  select id into v_org from public.questionario_dimensoes where slug='organizacao';
  select id into v_rel from public.questionario_dimensoes where slug='relacoes';
  select id into v_int from public.questionario_dimensoes where slug='interface';
  select id into v_sau from public.questionario_dimensoes where slug='saude';
  select id into v_ofe from public.questionario_dimensoes where slug='ofensivos';

  insert into public.questionario_perguntas (dimensao_id, codigo, texto, escala, reverse, ordem) values
    (v_dem,'d1','A sua carga de trabalho se acumula porque você não consegue dar conta?','freq',false,1),
    (v_dem,'d2','Você tem que trabalhar muito rapidamente?','freq',false,2),
    (v_dem,'d3','Seu trabalho exige que você esconda os seus sentimentos?','freq',false,3),
    (v_dem,'d4','Seu trabalho é emocionalmente desgastante?','freq',false,4),
    (v_org,'o1','Você tem influência sobre o que faz no seu trabalho?','grau',true,1),
    (v_org,'o2','Seu trabalho tem um sentido para você?','grau',true,2),
    (v_org,'o3','Você recebe com antecedência as informações necessárias para fazer bem o seu trabalho?','freq',true,3),
    (v_org,'o4','Você pode decidir quando fazer uma pausa?','freq',true,4),
    (v_rel,'r1','Você recebe ajuda e apoio dos seus colegas quando precisa?','freq',true,1),
    (v_rel,'r2','Sua chefia imediata dá prioridade ao bem-estar dos trabalhadores?','grau',true,2),
    (v_rel,'r3','Sua chefia é boa em planejar o trabalho?','grau',true,3),
    (v_rel,'r4','Você sabe exatamente o que se espera de você no trabalho?','grau',true,4),
    (v_int,'i1','Quão satisfeito você está com o seu trabalho de uma forma geral?','custom',true,1),
    (v_int,'i2','Você sente que o trabalho consome energia que faria falta para a vida pessoal?','freq',false,2),
    (v_int,'i3','Você sente que o trabalho exige tempo que faria falta para a vida pessoal?','freq',false,3),
    (v_sau,'s1','Com que frequência você se sente estressado(a)?','freq',false,1),
    (v_sau,'s2','Com que frequência você se sente esgotado(a) emocionalmente?','freq',false,2),
    (v_sau,'s3','Com que frequência você dorme mal por causa do trabalho?','freq',false,3),
    (v_sau,'s4','De forma geral, como você considera sua saúde?','custom',true,4),
    (v_ofe,'of1','Você foi exposto(a) a humilhação ou ridicularização no trabalho nos últimos 12 meses?','freq',false,1),
    (v_ofe,'of2','Você sofreu assédio moral (perseguição, ameaças) no trabalho nos últimos 12 meses?','freq',false,2),
    (v_ofe,'of3','Você sofreu assédio sexual no trabalho nos últimos 12 meses?','freq',false,3),
    (v_ofe,'of4','Você sofreu violência física no trabalho nos últimos 12 meses?','freq',false,4)
  on conflict (codigo) do nothing;

  select id into v_i1 from public.questionario_perguntas where codigo='i1';
  select id into v_s4 from public.questionario_perguntas where codigo='s4';

  insert into public.questionario_opcoes (pergunta_id, valor, rotulo, ordem) values
    (v_i1,5,'Muito satisfeito',1),(v_i1,4,'Satisfeito',2),(v_i1,3,'Neutro',3),(v_i1,2,'Insatisfeito',4),(v_i1,1,'Muito insatisfeito',5),
    (v_s4,5,'Excelente',1),(v_s4,4,'Muito boa',2),(v_s4,3,'Boa',3),(v_s4,2,'Razoável',4),(v_s4,1,'Ruim',5)
  on conflict do nothing;
end$$;
