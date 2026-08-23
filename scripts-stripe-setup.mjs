import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const plans = [
  { id: '17dddfcf-e30f-409e-919b-e377f7cd904f', nome: 'Empresa Essencial', preco: 197, interval: 'month' },
  { id: '0dfd01e2-7a92-40f2-8332-c523c30bc5d3', nome: 'Consultor Mensal', preco: 297, interval: 'month' },
  { id: '4e1a7bec-c0ab-4a6e-8ccf-a511f7c59717', nome: 'Empresa Profissional', preco: 397, interval: 'month' },
  { id: 'a6a3cad7-c81d-4f47-9592-00c2673b1dd9', nome: 'Consultor Semestral', preco: 495, interval: 'month', interval_count: 6, total: 2970 },
  { id: '8674220a-61db-4567-8629-3d002f549472', nome: 'Empresa Corporativo', preco: 897, interval: 'month' },
  { id: '6439221a-f90b-4153-831a-41503d73a8d6', nome: 'Consultor Anual', preco: 990, interval: 'year', total: 11880 },
];

const results = [];
for (const p of plans) {
  const product = await stripe.products.create({ name: `PsicoSafety - ${p.nome}` });
  let recurring;
  let unit_amount;
  if (p.interval === 'year') {
    recurring = { interval: 'year' };
    unit_amount = p.total * 100;
  } else if (p.interval_count) {
    recurring = { interval: 'month', interval_count: p.interval_count };
    unit_amount = p.total * 100;
  } else {
    recurring = { interval: 'month' };
    unit_amount = p.preco * 100;
  }
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount,
    currency: 'brl',
    recurring,
  });
  results.push({ id: p.id, nome: p.nome, price_id: price.id });
  console.log(`${p.nome}: ${price.id}`);
}
console.log(JSON.stringify(results, null, 2));
