-- Ajustar planos consultor para estrutura Mensal/Semestral/Anual a R$ 0,99 por avaliação
UPDATE public.plans
SET nome = 'Mensal', max_avaliacoes = 300, max_empresas = 9999, preco_mensal = 297.00
WHERE id = '0dfd01e2-7a92-40f2-8332-c523c30bc5d3';

UPDATE public.plans
SET nome = 'Semestral', max_avaliacoes = 3000, max_empresas = 9999, preco_mensal = 495.00
WHERE id = 'a6a3cad7-c81d-4f47-9592-00c2673b1dd9';

UPDATE public.plans
SET nome = 'Anual', max_avaliacoes = 12000, max_empresas = 9999, preco_mensal = 990.00
WHERE id = '6439221a-f90b-4153-831a-41503d73a8d6';