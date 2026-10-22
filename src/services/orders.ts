import { z } from 'zod';
import { pool, withTransaction, type Queryable } from '../db';
import { badRequest, notFound } from '../lib/httpError';
import { integer, optionalText, text } from '../lib/validation';
import { carDisplayName, toOrder } from '../mappers';
import type { CarRow, Order, OrderItemRow, OrderRow, OrderStatus } from '../types';

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        carId: integer('Car id', { min: 1 }),
        quantity: integer('Quantity', { min: 1, max: 1000 }),
      }),
      { error: 'Items must be a list of cars.' },
    )
    .min(1, 'Your order must contain at least one item.')
    .max(100, 'Your order has too many items.'),
  shippingName: text('Shipping name', { max: 120 }),
  shippingAddress: text('Shipping address', { max: 500 }),
  phone: text('Phone', { max: 30 }),
  notes: optionalText('Notes', 1000),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

interface OrderFilter {
  orderId?: number;
  userId?: number;
  status?: OrderStatus;
  includeUser?: boolean;
}

/** Loads orders (newest first) together with their items. */
export async function findOrders(filter: OrderFilter, db: Queryable = pool): Promise<Order[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.orderId !== undefined) {
    params.push(filter.orderId);
    conditions.push(`o.id = $${params.length}`);
  }
  if (filter.userId !== undefined) {
    params.push(filter.userId);
    conditions.push(`o.user_id = $${params.length}`);
  }
  if (filter.status !== undefined) {
    params.push(filter.status);
    conditions.push(`o.status = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const userColumns = filter.includeUser ? ', u.name AS user_name, u.email AS user_email' : '';

  const { rows: orderRows } = await db.query<OrderRow>(
    `SELECT o.*${userColumns}
       FROM orders o JOIN users u ON u.id = o.user_id
       ${where}
      ORDER BY o.created_at DESC, o.id DESC`,
    params,
  );
  if (orderRows.length === 0) return [];

  const { rows: itemRows } = await db.query<OrderItemRow>(
    `SELECT oi.*, c.image_url
       FROM order_items oi LEFT JOIN cars c ON c.id = oi.car_id
      WHERE oi.order_id = ANY($1::int[])
      ORDER BY oi.id`,
    [orderRows.map((order) => order.id)],
  );
  const itemsByOrder = new Map<number, OrderItemRow[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }
  return orderRows.map((order) => toOrder(order, itemsByOrder.get(order.id) ?? []));
}

async function findOrderOrThrow(orderId: number, db: Queryable, includeUser: boolean): Promise<Order> {
  const [order] = await findOrders({ orderId, includeUser }, db);
  if (!order) throw notFound('Order not found.');
  return order;
}

/** Merges duplicate car ids, summing their quantities. Sorted by car id for consistent lock order. */
function mergeItems(items: CreateOrderInput['items']): Map<number, number> {
  const merged = new Map<number, number>();
  for (const { carId, quantity } of [...items].sort((a, b) => a.carId - b.carId)) {
    merged.set(carId, (merged.get(carId) ?? 0) + quantity);
  }
  return merged;
}

export async function createOrder(userId: number, input: CreateOrderInput): Promise<Order> {
  const quantities = mergeItems(input.items);
  const carIds = [...quantities.keys()];

  return withTransaction(async (client) => {
    const { rows: cars } = await client.query<CarRow>(
      'SELECT * FROM cars WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
      [carIds],
    );
    const carsById = new Map(cars.map((car) => [car.id, car]));

    let totalCents = 0;
    for (const [carId, quantity] of quantities) {
      const car = carsById.get(carId);
      if (!car) throw badRequest(`Car #${carId} is no longer available.`);
      if (car.stock < quantity) {
        const available = car.stock === 0 ? 'it is out of stock' : `only ${car.stock} left in stock`;
        throw badRequest(`Not enough stock for ${carDisplayName(car)}: ${available}.`);
      }
      totalCents += Math.round(car.price * 100) * quantity;
    }

    const { rows: orderRows } = await client.query<{ id: number }>(
      `INSERT INTO orders (user_id, total, shipping_name, shipping_address, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, totalCents / 100, input.shippingName, input.shippingAddress, input.phone, input.notes],
    );
    const orderId = orderRows[0]?.id;
    if (orderId === undefined) throw new Error('Order insert returned no row');

    for (const [carId, quantity] of quantities) {
      const car = carsById.get(carId);
      if (!car) continue;
      await client.query(
        `INSERT INTO order_items (order_id, car_id, car_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, carId, carDisplayName(car), quantity, car.price],
      );
      await client.query('UPDATE cars SET stock = stock - $1, updated_at = now() WHERE id = $2', [
        quantity,
        carId,
      ]);
    }

    return findOrderOrThrow(orderId, client, false);
  });
}

/** Changes an order's status. Cancelling restores stock; cancelled orders are final. */
export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<Pick<OrderRow, 'status'>>(
      'SELECT status FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );
    const current = rows[0];
    if (!current) throw notFound('Order not found.');
    if (current.status === 'cancelled') {
      throw badRequest('This order has been cancelled and can no longer be changed.');
    }

    if (current.status !== status) {
      if (status === 'cancelled') {
        await client.query(
          `UPDATE cars c
              SET stock = c.stock + s.quantity, updated_at = now()
             FROM (SELECT car_id, SUM(quantity)::int AS quantity
                     FROM order_items
                    WHERE order_id = $1 AND car_id IS NOT NULL
                    GROUP BY car_id) s
            WHERE c.id = s.car_id`,
          [orderId],
        );
      }
      await client.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
    }

    return findOrderOrThrow(orderId, client, true);
  });
}
