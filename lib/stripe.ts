import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY est manquant dans les variables d\'environnement.');
}

export const stripe = new Stripe(stripeSecretKey, {
  typescript: true,
});
