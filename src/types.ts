export const ROLES = ['customer', 'admin'] as const;
export const USER_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const ORDER_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
export const FUEL_TYPES = ['Gasoline', 'Diesel', 'Hybrid', 'Electric'] as const;
export const TRANSMISSIONS = ['Automatic', 'Manual'] as const;
export const BODY_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Coupe'] as const;

export type Role = (typeof ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ---- Database rows (snake_case) ----

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  status: UserStatus;
  created_at: Date;
}

export interface CarRow {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  body_type: string;
  color: string;
  description: string;
  image_url: string;
  stock: number;
  created_at: Date;
  updated_at: Date;
}

export interface OrderRow {
  id: number;
  user_id: number;
  total: number;
  status: OrderStatus;
  shipping_name: string;
  shipping_address: string;
  phone: string;
  notes: string;
  created_at: Date;
  user_name?: string;
  user_email?: string;
}

export interface OrderItemRow {
  id: number;
  order_id: number;
  car_id: number | null;
  car_name: string;
  quantity: number;
  unit_price: number;
  image_url: string | null;
}

// ---- API shapes (camelCase) ----

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  bodyType: string;
  color: string;
  description: string;
  imageUrl: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  carId: number | null;
  carName: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
}

export interface Order {
  id: number;
  userId: number;
  total: number;
  status: OrderStatus;
  shippingName: string;
  shippingAddress: string;
  phone: string;
  notes: string;
  createdAt: string;
  items: OrderItem[];
  user?: { name: string; email: string };
}
