import type { ApiError } from '@betterfit/shared';
import type { FastifyReply } from 'fastify';

/**
 * Erreur métier renvoyée telle quelle au client.
 *
 * Le `code` est stable et traduit par l'app ; le `message` ne sert qu'aux
 * journaux et aux tests, il n'est jamais affiché directement.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  toPayload(): ApiError {
    return this.fields
      ? { code: this.code, message: this.message, fields: this.fields }
      : { code: this.code, message: this.message };
  }
}

export function badRequest(code: string, message: string, fields?: Record<string, string>) {
  return new HttpError(400, code, message, fields);
}

export function unauthorized(code: string, message: string) {
  return new HttpError(401, code, message);
}

export function forbidden(code: string, message: string) {
  return new HttpError(403, code, message);
}

export function notFound(code: string, message: string) {
  return new HttpError(404, code, message);
}

export function conflict(code: string, message: string, fields?: Record<string, string>) {
  return new HttpError(409, code, message, fields);
}

export function tooManyRequests(code: string, message: string, retryAfterSeconds: number) {
  const error = new HttpError(429, code, message);
  Object.defineProperty(error, 'retryAfterSeconds', { value: retryAfterSeconds });
  return error;
}

export function sendError(reply: FastifyReply, error: HttpError) {
  const retryAfter = (error as { retryAfterSeconds?: number }).retryAfterSeconds;
  if (retryAfter !== undefined) reply.header('retry-after', String(retryAfter));

  return reply.status(error.statusCode).send(error.toPayload());
}
