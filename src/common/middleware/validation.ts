import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../errors';

export const validate = (
  schema: AnyZodObject,
  source: 'body' | 'query' | 'params' | 'all' = 'all'
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      let dataToValidate: any = {};

      switch (source) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'all':
        default:
          dataToValidate = {
            ...req.body,
            ...req.query,
            ...req.params,
          };
      }

      await schema.parseAsync(dataToValidate);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
};

export const createRouteValidator = <T extends AnyZodObject>(schema: T) => {
  return {
    validate: validate(schema),
  };
};
