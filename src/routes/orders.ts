import { Router } from 'express';
import { currentUser, requireAuth } from '../middleware/auth';
import { createOrder, createOrderSchema, findOrders } from '../services/orders';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.post('/', async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const order = await createOrder(currentUser(req).id, input);
  res.status(201).json(order);
});

ordersRouter.get('/mine', async (req, res) => {
  res.json(await findOrders({ userId: currentUser(req).id }));
});
