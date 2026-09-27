import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';
import { ApiEnvelope } from './api-response';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

interface ErrorBody {
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = {
      code: CODE_BY_STATUS[status] ?? 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: undefined as unknown,
    };

    if (exception instanceof ThrottlerException) {
      error.message = 'Too many requests, please try again later';
    } else if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const errorBody: ErrorBody =
        typeof res === 'string' ? { message: res } : res;
      if (Array.isArray(errorBody.message)) {
        error.message = 'Validation failed';
        error.details = errorBody.message;
      } else {
        error.message = errorBody.message ?? exception.message;
        error.details = errorBody.details;
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiEnvelope<null> = { success: false, data: null, error };
    response.status(status).json(body);
  }
}
