// apps/api/src/routes/products.mjs
import { Router } from 'express';
import { listActiveProducts } from '../repositories/product-repository.mjs';

export function productsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const products = await listActiveProducts();
    return res.json({ products });
  });

  return router;
}
