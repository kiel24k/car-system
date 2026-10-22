import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';
import { forbidden, unauthorized } from '../lib/httpError';
import { toUser } from '../mappers';
import type { Role, User, UserRow } from '../types';

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth` to the freshly loaded, approved user. */
      user?: User;
    }
  }
}

interface TokenPayload {
  sub: number;
  role: Role;
}

export function signToken(user: User): string {
  const payload: TokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function readUserId(header: string | undefined): number {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw unauthorized('Authentication required.');
  }
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(match[1], config.jwtSecret);
  } catch {
    throw unauthorized('Invalid or expired token. Please log in again.');
  }
  const userId = typeof decoded === 'object' ? Number(decoded.sub) : NaN;
  if (!Number.isInteger(userId) || userId <= 0) {
    throw unauthorized('Invalid or expired token. Please log in again.');
  }
  return userId;
}

/** Verifies the JWT and re-loads the user from the database on every request. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const userId = readUserId(req.headers.authorization);
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
  const row = rows[0];
  if (!row || row.status !== 'approved') {
    throw unauthorized('Your account is not active. Please log in again.');
  }
  req.user = toUser(row);
  next();
};

/** Must run after `requireAuth`. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'admin') {
    throw forbidden('Admin access required.');
  }
  next();
};

/** Returns the authenticated user; only valid on routes guarded by `requireAuth`. */
export function currentUser(req: Express.Request): User {
  if (!req.user) {
    throw unauthorized('Authentication required.');
  }
  return req.user;
}
