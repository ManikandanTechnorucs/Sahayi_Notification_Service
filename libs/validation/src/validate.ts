import type { NextFunction, Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import { z, ZodError, type ZodType } from 'zod';

type RequestWithFiles = Request & {
  file?: unknown;
  files?: unknown;
};

type RequestValidationSchema = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  headers?: ZodType;
  file?: ZodType;
  files?: ZodType;
};

/**
 * Replaces a read-only Express 5 request property (e.g. query, params) with parsed data.
 */
function assignRequestProperty<T>(req: Request, key: 'query' | 'params' | 'body', value: T): void {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Creates Express middleware that validates request segments with Zod.
 */
export function validate(schema: RequestValidationSchema) {
  return (req: RequestWithFiles, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        assignRequestProperty(req, 'body', schema.body.parse(req.body));
      }

      if (schema.query) {
        assignRequestProperty(req, 'query', schema.query.parse(req.query) as ParsedQs);
      }

      if (schema.params) {
        assignRequestProperty(
          req,
          'params',
          schema.params.parse(req.params) as ParamsDictionary,
        );
      }

      if (schema.headers) {
        schema.headers.parse(req.headers);
      }

      if (schema.file) {
        req.file = schema.file.parse(req.file);
      }

      if (schema.files) {
        req.files = schema.files.parse(req.files);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        next({
          message: errors[0]?.message ?? 'Validation failed',
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          errors,
          details: z.treeifyError(error),
        });
        return;
      }

      next(error);
    }
  };
}
