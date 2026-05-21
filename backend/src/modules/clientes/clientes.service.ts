import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface CreateClienteDto {
  nome: string;
  fantasia?: string;
  cnpj?: string;
  tel?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  responsavel?: string;
  cargo?: string;
  profissionalId?: string | null;
}

@Injectable()
export class ClientesService {
  constructor(private db: DatabaseService) {}

  findAll() {
    return this.db.instance.prepare(`
      SELECT c.*,
        p.nome AS profissional_nome,
        p.crea AS profissional_crea,
        COUNT(DISTINCT e.id) as total_equipamentos
      FROM clientes c
      LEFT JOIN equipamentos e   ON e.cliente_id = c.id
      LEFT JOIN profissionais p  ON p.id         = c.profissional_id
      GROUP BY c.id
      ORDER BY c.nome
    `).all();
  }

  findOne(id: string) {
    const cliente = this.db.instance.prepare(`
      SELECT c.*,
        p.nome AS profissional_nome,
        p.crea AS profissional_crea
      FROM clientes c
      LEFT JOIN profissionais p ON p.id = c.profissional_id
      WHERE c.id = ?
    `).get(id);
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    return cliente;
  }

  create(dto: CreateClienteDto) {
    const id = uuidv4();
    this.db.instance.prepare(`
      INSERT INTO clientes (id, nome, fantasia, cnpj, tel, email, cep, logradouro, numero, bairro, cidade, uf, responsavel, cargo, profissional_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, dto.nome, dto.fantasia, dto.cnpj, dto.tel, dto.email, dto.cep, dto.logradouro, dto.numero, dto.bairro, dto.cidade, dto.uf, dto.responsavel, dto.cargo, dto.profissionalId || null);
    return this.findOne(id);
  }

  update(id: string, dto: Partial<CreateClienteDto>) {
    this.findOne(id);
    const map: Record<string, string> = {
      nome: 'nome',
      fantasia: 'fantasia',
      cnpj: 'cnpj',
      tel: 'tel',
      email: 'email',
      cep: 'cep',
      logradouro: 'logradouro',
      numero: 'numero',
      bairro: 'bairro',
      cidade: 'cidade',
      uf: 'uf',
      responsavel: 'responsavel',
      cargo: 'cargo',
      profissionalId: 'profissional_id',
    };

    const sets: string[] = [];
    const vals: any[] = [];
    Object.entries(dto).forEach(([k, v]) => {
      const col = map[k];
      if (!col || v === undefined) return;
      sets.push(`${col} = ?`);
      vals.push(typeof v === 'string' ? (v.trim() || null) : v);
    });

    if (!sets.length) return this.findOne(id);
    this.db.instance.prepare(
      `UPDATE clientes SET ${sets.join(', ')}, atualizado_em = datetime('now') WHERE id = ?`
    ).run(...vals, id);
    return this.findOne(id);
  }

  remove(id: string) {
    this.findOne(id);
    // Remove o arquivo de logo do disco, se houver
    const row = this.db.instance.prepare(
      'SELECT logo_filename FROM clientes WHERE id = ?'
    ).get(id) as any;
    if (row?.logo_filename) this.apagarArquivo(row.logo_filename);
    this.db.instance.prepare('DELETE FROM clientes WHERE id = ?').run(id);
    return { deleted: true };
  }

  // ── Logo do cliente ────────────────────────────────────────────────────
  private apagarArquivo(filename: string) {
    try {
      const p = join(process.cwd(), 'uploads', filename);
      if (existsSync(p)) unlinkSync(p);
    } catch {
      // Falha ao apagar arquivo antigo não deve interromper a operação.
    }
  }

  setLogo(id: string, file: Express.Multer.File) {
    this.findOne(id);
    // Remove o logo anterior, se existir, antes de gravar o novo
    const row = this.db.instance.prepare(
      'SELECT logo_filename FROM clientes WHERE id = ?'
    ).get(id) as any;
    if (row?.logo_filename) this.apagarArquivo(row.logo_filename);

    this.db.instance.prepare(
      `UPDATE clientes SET logo_filename = ?, atualizado_em = datetime('now') WHERE id = ?`
    ).run(file.filename, id);
    return this.findOne(id);
  }

  removeLogo(id: string) {
    this.findOne(id);
    const row = this.db.instance.prepare(
      'SELECT logo_filename FROM clientes WHERE id = ?'
    ).get(id) as any;
    if (row?.logo_filename) this.apagarArquivo(row.logo_filename);
    this.db.instance.prepare(
      `UPDATE clientes SET logo_filename = NULL, atualizado_em = datetime('now') WHERE id = ?`
    ).run(id);
    return this.findOne(id);
  }

}