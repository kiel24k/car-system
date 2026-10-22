import { Router } from 'express';
import { pool } from '../../db';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { adminCarsRouter } from './cars';
import { adminOrdersRouter } from './orders';
import { adminUsersRouter } from './users';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', async (_req, res) => {
  const { rows } = await pool.query<{
    pending_users: number;
    total_cars: number;
    total_orders: number;
    revenue: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE status = 'pending') AS pending_users,
      (SELECT COUNT(*) FROM cars) AS total_cars,
      (SELECT COUNT(*) FROM orders) AS total_orders,
      (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status <> 'cancelled') AS revenue
  `);
  const row = rows[0];
  res.json({
    pendingUsers: row?.pending_users ?? 0,
    totalCars: row?.total_cars ?? 0,
    totalOrders: row?.total_orders ?? 0,
    revenue: row?.revenue ?? 0,
  });
});

adminRouter.use('/users', adminUsersRouter);
adminRouter.use('/cars', adminCarsRouter);
adminRouter.use('/orders', adminOrdersRouter);
