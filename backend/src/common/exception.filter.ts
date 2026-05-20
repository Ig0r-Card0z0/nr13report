import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp();
    const res    = ctx.getResponse<Response>();
    const req    = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Erro interno do servidor';

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`${req.method} ${req.url} — ${status} — ${JSON.stringify(message)}${stack ? '\n' + stack : ''}`);

    const isDev = process.env.NODE_ENV !== 'production';
    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      message: typeof message === 'object' ? (message as any).message || message : message,
      ...(isDev && stack ? { detail: stack.split('\n')[0] } : {}),
    });
  }
}
