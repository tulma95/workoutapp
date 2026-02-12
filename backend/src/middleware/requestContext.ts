import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContextStorage, RequestContext } from '../lib/requestContext';

export function requestContext(req: Request, _res: Response, next: NextFunction) {
  const context: RequestContext = {
    requestId: randomUUID(),
    method: req.method,
    path: req.path,
    startTime: Date.now(),
  };

  requestContextStorage.run(context, next);
}
