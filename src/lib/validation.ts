import { z } from 'zod';

/**
 * Field helpers that always produce full, human-readable error messages
 * (the error handler returns the first issue's message as-is).
 */

export function text(label: string, opts: { min?: number; max?: number } = {}) {
  const { min = 1, max = 500 } = opts;
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);
}

export function optionalText(label: string, max = 2000) {
  return z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .default('');
}

export function integer(label: string, opts: { min?: number; max?: number } = {}) {
  const { min = 0, max = 2_147_483_647 } = opts;
  return z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be at most ${max}.`);
}

export function oneOf<const T extends readonly [string, ...string[]]>(label: string, values: T) {
  return z.enum(values, { error: `${label} must be one of: ${values.join(', ')}.` });
}

/** Treats empty query-string values ("?make=") as absent. */
export function queryParam<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

// Capped at the INT4 maximum so out-of-range ids are treated as invalid (404) instead of a DB error.
const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

/** Parses a positive integer route parameter, or returns null if invalid. */
export function parseId(value: string | string[] | undefined): number | null {
  const result = idSchema.safeParse(value);
  return result.success ? result.data : null;
}
