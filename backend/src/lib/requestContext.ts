import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  userId?: number;
  startTime: number;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function setUserId(id: number): void {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    ctx.userId = id;
  }
}
