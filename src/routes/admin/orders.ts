import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/httpError';
import { oneOf, parseId, queryParam } from '../../lib/validation';
import { findOrders, updateOrderStatus } from '../../services/orders';
import { ORDER_STATUSES } from '../../types';

const listQuerySchema = z.object({
  status: queryParam(oneOf('Status', ORDER_STATUSES)),
});

const statusBodySchema = z.object({
  status: oneOf('Status', ORDER_STATUSES),
});

export const adminOrdersRouter = Router();

adminOrdersRouter.get('/', async (req, res) => {
  const { status } = listQuerySchema.parse(req.query);
  res.json(await findOrders({ status, includeUser: true }));
});

adminOrdersRouter.patch('/:id/status', async (req, res) => {
  const { status } = statusBodySchema.parse(req.body);
  const id = parseId(req.params.id);
  if (id === null) throw notFound('Order not found.');
  res.json(await updateOrderStatus(id, status));
});
