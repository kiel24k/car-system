import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

function hasNumericStatus(error: unknown): error is { status: number; expose?: boolean; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'message' in error
  );
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const message =
      issue && issue.path.length === 0 && issue.code === 'invalid_type'
        ? 'Invalid request body.'
        : (issue?.message ?? 'Invalid request.');
    res.status(400).json({ error: message });
    return;
  }

  // Errors raised by body-parser (malformed JSON, payload too large, ...).
  if (hasNumericStatus(error) && error.status >= 400 && error.status < 500) {
    const message = error.status === 400 ? 'Malformed JSON request body.' : error.message;
    res.status(error.status).json({ error: message });
    return;
  }

  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error.' });
};
