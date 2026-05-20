import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(private db: DatabaseService) {}

  @Get('health')
  health() {
    const tables = this.db.instance
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    return {
      status: 'ok',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      database: 'connected',
      tables: tables.map(t => t.name),
    };
  }
}
