import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { conflict, forbidden, unauthorized } from '../lib/httpError';
import { text } from '../lib/validation';
import { currentUser, requireAuth, signToken } from '../middleware/auth';
import { toUser } from '../mappers';
import type { UserRow } from '../types';

const PG_UNIQUE_VIOLATION = '23505';
const BCRYPT_ROUNDS = 10;

const emailSchema = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Please enter a valid email address.'));

const registerSchema = z.object({
  name: text('Name', { min: 2, max: 100 }),
  email: emailSchema,
  password: z
    .string({ error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.')
    .max(200, 'Password must be at most 200 characters.'),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === PG_UNIQUE_VIOLATION;
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [
      name,
      email,
      passwordHash,
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('An account with this email already exists.');
    }
    throw error;
  }
  res.status(201).json({ message: 'Registration submitted. Please wait for admin approval.' });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  const row = rows[0];
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw unauthorized('Invalid email or password.');
  }
  if (row.status === 'pending') {
    throw forbidden('Your account is awaiting admin approval.');
  }
  if (row.status === 'rejected') {
    throw forbidden('Your registration was rejected.');
  }
  const user = toUser(row);
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: currentUser(req) });
});
