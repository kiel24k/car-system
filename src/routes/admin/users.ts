import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db';
import { badRequest, notFound } from '../../lib/httpError';
import { oneOf, parseId, queryParam } from '../../lib/validation';
import { currentUser } from '../../middleware/auth';
import { toUser } from '../../mappers';
import { USER_STATUSES, type UserRow } from '../../types';

const listQuerySchema = z.object({
  status: queryParam(oneOf('Status', USER_STATUSES)),
});

const statusBodySchema = z.object({
  status: oneOf('Status', ['approved', 'rejected']),
});

export const adminUsersRouter = Router();

adminUsersRouter.get('/', async (req, res) => {
  const { status } = listQuerySchema.parse(req.query);
  const { rows } = status
    ? await pool.query<UserRow>('SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC, id DESC', [status])
    : await pool.query<UserRow>('SELECT * FROM users ORDER BY created_at DESC, id DESC');
  res.json(rows.map(toUser));
});

adminUsersRouter.patch('/:id/status', async (req, res) => {
  const { status } = statusBodySchema.parse(req.body);
  const id = parseId(req.params.id);
  if (id === null) throw notFound('User not found.');
  if (id === currentUser(req).id) throw badRequest('You cannot change your own account status.');

  const { rows } = await pool.query<UserRow>('UPDATE users SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
  const row = rows[0];
  if (!row) throw notFound('User not found.');
  res.json(toUser(row));
});
