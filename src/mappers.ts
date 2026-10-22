import type { Car, CarRow, Order, OrderItem, OrderItemRow, OrderRow, User, UserRow } from './types';

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export function toCar(row: CarRow): Car {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    year: row.year,
    price: row.price,
    mileage: row.mileage,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    bodyType: row.body_type,
    color: row.color,
    description: row.description,
    imageUrl: row.image_url,
    stock: row.stock,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    carId: row.car_id,
    carName: row.car_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    imageUrl: row.image_url,
  };
}

export function toOrder(row: OrderRow, items: OrderItemRow[]): Order {
  const order: Order = {
    id: row.id,
    userId: row.user_id,
    total: row.total,
    status: row.status,
    shippingName: row.shipping_name,
    shippingAddress: row.shipping_address,
    phone: row.phone,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    items: items.map(toOrderItem),
  };
  if (row.user_name !== undefined && row.user_email !== undefined) {
    order.user = { name: row.user_name, email: row.user_email };
  }
  return order;
}

/** Display name snapshot stored on order items, e.g. "2022 Toyota Vios". */
export function carDisplayName(car: Pick<CarRow, 'year' | 'make' | 'model'>): string {
  return `${car.year} ${car.make} ${car.model}`;
}
