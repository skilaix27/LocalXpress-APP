import { Response } from 'express';
import { PaginatedResult } from '../types';

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json(data);
}

export function created<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function paginated<T>(res: Response, result: PaginatedResult<T>): void {
  res.status(200).json(result);
}

export function buildPagination(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1')));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '50'))));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
