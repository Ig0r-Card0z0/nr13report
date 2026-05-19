import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface CreateInstrumentoDto {
  nome: string;
  tipo?: string;
  fabricante?: string;
  modelo?: string;
  serie?: string;
  certificadoNumero?: string;
  dataCalibracao?: string;
  validadeCalibracao?: string;
  observacoes?: string;
}

@Injectable()
export class InstrumentosService {
  constructor(private db: DatabaseService) {}

  findAll() {
    return this.db.instance.prepare(
      `SELECT * FROM instrumentos_medicao ORDER BY nome`,
    ).all();
  }

  findOne(id: string) {
    const i = this.db.instance.prepare(
      `SELECT * FROM instrumentos_medicao WHERE id = ?`,
    ).get(id);
    if (!i) throw new NotFoundException('Instrumento não encontrado');
    return i;
  }

  create(dto: CreateInstrumentoDto) {
    const id = uuidv4();
    this.db.instance.prepare(`
      INSERT INTO instrumentos_medicao (
        id, nome, tipo, fabricante, modelo, serie,
        certificado_numero, data_calibracao, validade_calibracao, observacoes
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, dto.nome, dto.tipo, dto.fabricante, dto.modelo, dto.serie,
      dto.certificadoNumero, dto.dataCalibracao, dto.validadeCalibracao, dto.observacoes,
    );
    return this.findOne(id);
  }

  update(id: string, dto: Partial<CreateInstrumentoDto>) {
    this.findOne(id);
    const map: Record<string, string> = {
      nome: 'nome', tipo: 'tipo', fabricante: 'fabricante', modelo: 'modelo',
      serie: 'serie', certificadoNumero: 'certificado_numero',
      dataCalibracao: 'data_calibracao', validadeCalibracao: 'validade_calibracao',
      observacoes: 'observacoes',
    };
    const sets: string[] = [];
    const vals: any[] = [];
    Object.entries(dto).forEach(([k, v]) => {
      if (map[k] && v !== undefined) { sets.push(`${map[k]} = ?`); vals.push(v); }
    });
    if (!sets.length) return this.findOne(id);
    this.db.instance.prepare(
      `UPDATE instrumentos_medicao SET ${sets.join(', ')}, atualizado_em = datetime('now') WHERE id = ?`,
    ).run(...vals, id);
    return this.findOne(id);
  }

  remove(id: string) {
    const instr = this.findOne(id) as any;
    if (instr.certificado_filename) {
      const filePath = join(process.cwd(), 'uploads', instr.certificado_filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare(`DELETE FROM instrumentos_medicao WHERE id = ?`).run(id);
    return { deleted: true };
  }

  uploadCertificado(id: string, filename: string) {
    const existing = this.findOne(id) as any;
    if (existing.certificado_filename) {
      const oldPath = join(process.cwd(), 'uploads', existing.certificado_filename);
      try {
        if (existsSync(oldPath)) unlinkSync(oldPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare(
      `UPDATE instrumentos_medicao SET certificado_filename = ?, atualizado_em = datetime('now') WHERE id = ?`,
    ).run(filename, id);
    return this.findOne(id);
  }

  removeCertificado(id: string) {
    const instr = this.findOne(id) as any;
    if (instr.certificado_filename) {
      const filePath = join(process.cwd(), 'uploads', instr.certificado_filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
      this.db.instance.prepare(
        `UPDATE instrumentos_medicao SET certificado_filename = NULL, atualizado_em = datetime('now') WHERE id = ?`,
      ).run(id);
    }
    return this.findOne(id);
  }
}
