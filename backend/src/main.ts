import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exception.filter';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  ['data', 'uploads', 'public'].forEach(d => {
    const p = join(process.cwd(), d);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  });

  const app = await NestFactory.create(AppModule, {
    cors: false,
    bodyParser: false,  // disable default body parser so we control it
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug'],
  });

  // Register body parsers first (before routes)
  const express = require('express');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.enableCors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
      : ['http://localhost:9001', 'http://127.0.0.1:9001'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = parseInt(process.env.PORT || '9000', 10);
  await app.listen(port, '0.0.0.0');

  console.log(`\n🚀 NR-13 API: http://localhost:${port}`);
  console.log(`   Banco: ${join(process.cwd(), 'data', 'nr13.sqlite')}`);
  console.log(`   Env:   ${process.env.NODE_ENV || 'development'}\n`);
}
bootstrap();
