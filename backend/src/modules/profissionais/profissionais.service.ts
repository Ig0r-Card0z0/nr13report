import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProfissionalDto {
  nome: string;
  crea?: string;
  email?: string;
  telefone?: string;
  especialidade?: string;
  observacoes?: string;
}

@Injectable()
export class ProfissionaisService {
  constructor(private db: DatabaseService) {}

  findAll() {
    return this.db.instance.prepare(
      `SELECT * FROM profissionais ORDER BY nome`,
    ).all();
  }

  findOne(id: string) {
    const p = this.db.instance.prepare(
      `SELECT * FROM profissionais WHERE id = ?`,
    ).get(id);
    if (!p) throw new NotFoundException('Profissional não encontrado');
    return p;
  }

  create(dto: CreateProfissionalDto) {
    if (!dto.nome || !dto.nome.trim()) {
      throw new BadRequestException('Nome do profissional é obrigatório.');
    }
    const id = uuidv4();
    this.db.instance.prepare(`
      INSERT INTO profissionais (id, nome, crea, email, telefone, especialidade, observacoes)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      id,
      dto.nome.trim(),
      dto.crea?.trim() || null,
      dto.email?.trim() || null,
      dto.telefone?.trim() || null,
      dto.especialidade?.trim() || null,
      dto.observacoes?.trim() || null,
    );
    return this.findOne(id);
  }

  update(id: string, dto: Partial<CreateProfissionalDto>) {
    this.findOne(id);
    const map: Record<string, string> = {
      nome: 'nome', crea: 'crea', email: 'email', telefone: 'telefone',
      especialidade: 'especialidade', observacoes: 'observacoes',
    };
    const sets: string[] = [];
    const vals: any[] = [];
    Object.entries(dto).forEach(([k, v]) => {
      if (map[k] && v !== undefined) {
        sets.push(`${map[k]} = ?`);
        vals.push(typeof v === 'string' ? v.trim() || null : v);
      }
    });
    if (!sets.length) return this.findOne(id);
    this.db.instance.prepare(
      `UPDATE profissionais SET ${sets.join(', ')}, atualizado_em = datetime('now') WHERE id = ?`,
    ).run(...vals, id);
    return this.findOne(id);
  }

  remove(id: string) {
    this.findOne(id);
    this.db.instance.prepare(`DELETE FROM profissionais WHERE id = ?`).run(id);
    return { deleted: true };
  }
}
