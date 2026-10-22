import { z } from 'zod';
import { pool } from '../db';
import { integer, oneOf, optionalText, queryParam, text } from '../lib/validation';
import { toCar } from '../mappers';
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, type Car, type CarRow } from '../types';

const MAX_LIMIT = 50;

/** Whitelisted ORDER BY clauses; user input never reaches the SQL text. */
const SORT_CLAUSES = {
  newest: 'created_at DESC, id DESC',
  price_asc: 'price ASC, id ASC',
  price_desc: 'price DESC, id DESC',
  year_desc: 'year DESC, id DESC',
} as const;

type SortKey = keyof typeof SORT_CLAUSES;
const SORT_KEYS = Object.keys(SORT_CLAUSES) as [SortKey, ...SortKey[]];

const price = (label: string) => z.coerce.number({ error: `${label} must be a number.` }).min(0, `${label} cannot be negative.`);

export const carListQuerySchema = z.object({
  search: queryParam(z.string().trim().max(100, 'Search must be at most 100 characters.')),
  make: queryParam(z.string().trim()),
  bodyType: queryParam(z.string().trim()),
  fuelType: queryParam(z.string().trim()),
  transmission: queryParam(z.string().trim()),
  minPrice: queryParam(price('Minimum price')),
  maxPrice: queryParam(price('Maximum price')),
  sort: queryParam(oneOf('Sort', SORT_KEYS)),
  page: queryParam(z.coerce.number({ error: 'Page must be a number.' }).int('Page must be a whole number.').min(1, 'Page must be at least 1.')),
  limit: queryParam(z.coerce.number({ error: 'Limit must be a number.' }).int('Limit must be a whole number.').min(1, 'Limit must be at least 1.')),
});

export type CarListQuery = z.infer<typeof carListQuerySchema>;

export const carInputSchema = z.object({
  make: text('Make', { max: 60 }),
  model: text('Model', { max: 80 }),
  year: integer('Year', { min: 1900, max: new Date().getFullYear() + 1 }),
  price: z
    .number({ error: 'Price must be a number.' })
    .min(0, 'Price cannot be negative.')
    .max(9_999_999_999.99, 'Price is too large.'),
  mileage: integer('Mileage', { min: 0 }).default(0),
  fuelType: oneOf('Fuel type', FUEL_TYPES),
  transmission: oneOf('Transmission', TRANSMISSIONS),
  bodyType: oneOf('Body type', BODY_TYPES),
  color: optionalText('Color', 40),
  description: optionalText('Description', 5000),
  imageUrl: optionalText('Image URL', 2000).refine(
    (value) => value === '' || /^https?:\/\/\S+$/i.test(value),
    'Image URL must be a valid http(s) URL.',
  ),
  stock: integer('Stock', { min: 0 }).default(1),
});

export type CarInput = z.infer<typeof carInputSchema>;

/** Escapes LIKE wildcards so user input is matched literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export async function listCars(query: CarListQuery) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const addParam = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (query.search) {
    const p = addParam(likePattern(query.search));
    conditions.push(
      `(make ILIKE ${p} OR model ILIKE ${p} OR description ILIKE ${p} OR (make || ' ' || model) ILIKE ${p})`,
    );
  }
  if (query.make) conditions.push(`make = ${addParam(query.make)}`);
  if (query.bodyType) conditions.push(`body_type = ${addParam(query.bodyType)}`);
  if (query.fuelType) conditions.push(`fuel_type = ${addParam(query.fuelType)}`);
  if (query.transmission) conditions.push(`transmission = ${addParam(query.transmission)}`);
  if (query.minPrice !== undefined) conditions.push(`price >= ${addParam(query.minPrice)}`);
  if (query.maxPrice !== undefined) conditions.push(`price <= ${addParam(query.maxPrice)}`);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 12, MAX_LIMIT);
  const orderBy = SORT_CLAUSES[query.sort ?? 'newest'];

  const countResult = await pool.query<{ total: number }>(`SELECT COUNT(*) AS total FROM cars ${where}`, params);
  const limitParam = addParam(limit);
  const offsetParam = addParam((page - 1) * limit);
  const { rows } = await pool.query<CarRow>(
    `SELECT * FROM cars ${where} ORDER BY ${orderBy} LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  return { data: rows.map(toCar), total: countResult.rows[0]?.total ?? 0, page, limit };
}

export async function getCarFilters() {
  const { rows } = await pool.query<{
    makes: string[];
    body_types: string[];
    fuel_types: string[];
    transmissions: string[];
  }>(`
    SELECT
      ARRAY(SELECT DISTINCT make FROM cars ORDER BY make) AS makes,
      ARRAY(SELECT DISTINCT body_type FROM cars ORDER BY body_type) AS body_types,
      ARRAY(SELECT DISTINCT fuel_type FROM cars ORDER BY fuel_type) AS fuel_types,
      ARRAY(SELECT DISTINCT transmission FROM cars ORDER BY transmission) AS transmissions
  `);
  const row = rows[0];
  return {
    makes: row?.makes ?? [],
    bodyTypes: row?.body_types ?? [],
    fuelTypes: row?.fuel_types ?? [],
    transmissions: row?.transmissions ?? [],
  };
}

export async function findCar(id: number): Promise<Car | null> {
  const { rows } = await pool.query<CarRow>('SELECT * FROM cars WHERE id = $1', [id]);
  return rows[0] ? toCar(rows[0]) : null;
}

const CAR_COLUMNS = [
  'make',
  'model',
  'year',
  'price',
  'mileage',
  'fuel_type',
  'transmission',
  'body_type',
  'color',
  'description',
  'image_url',
  'stock',
] as const;

function carValues(input: CarInput): unknown[] {
  return [
    input.make,
    input.model,
    input.year,
    input.price,
    input.mileage,
    input.fuelType,
    input.transmission,
    input.bodyType,
    input.color,
    input.description,
    input.imageUrl,
    input.stock,
  ];
}

export async function createCar(input: CarInput): Promise<Car> {
  const placeholders = CAR_COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await pool.query<CarRow>(
    `INSERT INTO cars (${CAR_COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    carValues(input),
  );
  const row = rows[0];
  if (!row) throw new Error('Car insert returned no row');
  return toCar(row);
}

export async function updateCar(id: number, input: CarInput): Promise<Car | null> {
  const assignments = CAR_COLUMNS.map((column, i) => `${column} = $${i + 1}`).join(', ');
  const values = carValues(input);
  const { rows } = await pool.query<CarRow>(
    `UPDATE cars SET ${assignments}, updated_at = now() WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id],
  );
  return rows[0] ? toCar(rows[0]) : null;
}

export async function deleteCar(id: number): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM cars WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
