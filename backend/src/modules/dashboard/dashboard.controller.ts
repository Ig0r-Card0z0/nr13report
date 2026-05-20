import { Controller, Get, Query } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private db: DatabaseService) {}

  @Get('stats')
  stats() {
    const clientes    = (this.db.instance.prepare('SELECT COUNT(*) as n FROM clientes').get() as any).n;
    const equipamentos= (this.db.instance.prepare('SELECT COUNT(*) as n FROM equipamentos').get() as any).n;
    const inspecoes   = (this.db.instance.prepare('SELECT COUNT(*) as n FROM inspecoes').get() as any).n;
    const fotos       = (this.db.instance.prepare('SELECT COUNT(*) as n FROM fotos').get() as any).n;

    const vencendo90 = this.db.instance.prepare(`
      SELECT COUNT(*) as n FROM equipamentos
      WHERE prox_externo IS NOT NULL
        AND julianday(prox_externo) - julianday('now') <= 90
    `).get() as any;

    const vencidos = this.db.instance.prepare(`
      SELECT COUNT(*) as n FROM equipamentos
      WHERE prox_externo IS NOT NULL
        AND julianday(prox_externo) < julianday('now')
    `).get() as any;

    return { clientes, equipamentos, inspecoes, fotos, vencendo90: vencendo90.n, vencidos: vencidos.n };
  }

  @Get('vencimentos')
  vencimentos(@Query('dias') dias = '90') {
    return this.db.instance.prepare(`
      SELECT e.id, e.tag, e.tipo, e.categoria, e.prox_externo, e.prox_interno, e.prox_hidro,
        c.nome as cliente_nome, c.id as cliente_id,
        CAST(julianday(e.prox_externo) - julianday('now') AS INTEGER) as dias_restantes
      FROM equipamentos e
      LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE e.prox_externo IS NOT NULL
        AND julianday(e.prox_externo) - julianday('now') <= ?
      ORDER BY e.prox_externo ASC
      LIMIT 20
    `).all(parseInt(dias));
  }

  @Get('recentes')
  recentes() {
    return this.db.instance.prepare(`
      SELECT e.id, e.tag, e.tipo, e.categoria, e.prox_externo, e.criado_em,
        c.nome as cliente_nome, c.id as cliente_id
      FROM equipamentos e
      LEFT JOIN clientes c ON c.id = e.cliente_id
      ORDER BY e.criado_em DESC
      LIMIT 8
    `).all();
  }
}
