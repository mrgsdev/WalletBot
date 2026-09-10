import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Оборачивает async-обработчик, чтобы ошибки уходили в общий error middleware. */
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
