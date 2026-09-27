import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ApiEnvelope, Paginated } from './api-response';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiEnvelope<unknown>> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof Paginated) {
          return {
            success: true,
            data: result.items,
            error: null,
            meta: result.meta,
          };
        }
        return { success: true, data: result ?? null, error: null };
      }),
    );
  }
}
