import bcrypt from 'bcryptjs';
import type { Client } from 'pg';
import { SEED_CARS } from './seedData';

const ADMIN = { name: 'Administrator', email: 'admin@carshop.com', password: 'admin123' } as const;

/** Creates the admin account if it does not exist. Returns true if it was created. */
async function seedAdmin(client: Client): Promise<boolean> {
  const passwordHash = await bcrypt.hash(ADMIN.password, 10);
  const { rowCount } = await client.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'admin', 'approved')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN.name, ADMIN.email, passwordHash],
  );
  return (rowCount ?? 0) > 0;
}

/** Inserts the sample cars only when the cars table is empty. Returns the number inserted. */
async function seedCars(client: Client): Promise<number> {
  const { rows } = await client.query<{ count: string }>('SELECT COUNT(*) AS count FROM cars');
  if (Number(rows[0]?.count ?? 0) > 0) return 0;

  for (const car of SEED_CARS) {
    await client.query(
      `INSERT INTO cars (make, model, year, price, mileage, fuel_type, transmission, body_type,
                         color, description, image_url, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        car.make,
        car.model,
        car.year,
        car.price,
        car.mileage,
        car.fuelType,
        car.transmission,
        car.bodyType,
        car.color,
        car.description,
        car.imageUrl,
        car.stock,
      ],
    );
  }
  return SEED_CARS.length;
}

export async function seed(client: Client): Promise<void> {
  const adminCreated = await seedAdmin(client);
  console.log(adminCreated ? `Created admin ${ADMIN.email}` : `Admin ${ADMIN.email} already exists`);
  const carsInserted = await seedCars(client);
  console.log(carsInserted > 0 ? `Inserted ${carsInserted} sample cars` : 'Cars already present, skipping car seed');
}
