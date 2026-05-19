import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { unlinkSync } from 'fs';
import { join } from 'path';

export interface CreateMedicaoDto {
  equipamentoId: string;
  inspecaoId?: string;
  instrumentoId?: string;
  dataEnsaio?: string;
  norma?: string;
  procedimento?: string;
  equipamentoMed?: string;
  cabecote?: string;
  acoplante?: string;
  certCalibracao?: string;
  dataCalibracao?: string;
  validadeCalibracao?: string;
  metalBase?: string;
  condicaoSuperficial?: string;
  temperaturaPeca?: number;
  inspetor?: string;
  conclusao?: string;
  pontos?: PontoMeDto[];
}

export interface PontoMeDto {
  numero: string;
  regiao?: string;
  espessuraNominal?: number;
  espessuraEncontrada?: number;
  espessuraMinima?: number;
}

@Injectable()
export class MeService {
  constructor(private db: DatabaseService) {}

  findByEquipamento(equipamentoId: string) {
    const medicoes = this.db.instance.prepare(
      'SELECT * FROM medicoes_espessura WHERE equipamento_id = ? ORDER BY criado_em DESC'
    ).all(equipamentoId) as any[];
    return medicoes.map(m => ({
      ...m,
      pontos: this.db.instance.prepare(
        'SELECT * FROM pontos_me WHERE medicao_id = ? ORDER BY ordem'
      ).all(m.id),
    }));
  }

  findByInspecao(inspecaoId: string) {
    const medicoes = this.db.instance.prepare(
      'SELECT * FROM medicoes_espessura WHERE inspecao_id = ? ORDER BY criado_em DESC'
    ).all(inspecaoId) as any[];
    return medicoes.map(m => ({
      ...m,
      pontos: this.db.instance.prepare(
        'SELECT * FROM pontos_me WHERE medicao_id = ? ORDER BY ordem'
      ).all(m.id),
    }));
  }

  findOne(id: string) {
    const m = this.db.instance.prepare(
      'SELECT * FROM medicoes_espessura WHERE id = ?'
    ).get(id) as any;
    if (!m) throw new NotFoundException('Medição não encontrada');
    return { ...m, pontos: this.db.instance.prepare('SELECT * FROM pontos_me WHERE medicao_id = ? ORDER BY ordem').all(id) };
  }

  upsert(dto: CreateMedicaoDto) {
    const tx = this.db.instance.transaction(() => {
      const existing = dto.inspecaoId
        ? this.db.instance.prepare(
          'SELECT id FROM medicoes_espessura WHERE inspecao_id = ? ORDER BY criado_em DESC LIMIT 1'
        ).get(dto.inspecaoId) as any
        : this.db.instance.prepare(
          'SELECT id FROM medicoes_espessura WHERE equipamento_id = ? ORDER BY criado_em DESC LIMIT 1'
        ).get(dto.equipamentoId) as any;

      const id = existing ? existing.id : uuidv4();

      if (existing) {
        this.db.instance.prepare(`
          UPDATE medicoes_espessura SET
            inspecao_id=?, instrumento_id=?, data_ensaio=?, norma=?, procedimento=?, equipamento_med=?,
            cabecote=?, acoplante=?, cert_calibracao=?, data_calibracao=?,
            validade_calibracao=?, metal_base=?, condicao_superficial=?,
            temperatura_peca=?, inspetor=?, conclusao=?, atualizado_em=datetime('now')
          WHERE id=?
        `).run(
          dto.inspecaoId,
          dto.instrumentoId || null,
          dto.dataEnsaio,
          dto.norma,
          dto.procedimento,
          dto.equipamentoMed,
          dto.cabecote,
          dto.acoplante,
          dto.certCalibracao,
          dto.dataCalibracao,
          dto.validadeCalibracao,
          dto.metalBase,
          dto.condicaoSuperficial,
          dto.temperaturaPeca,
          dto.inspetor,
          dto.conclusao,
          id,
        );
      } else {
        this.db.instance.prepare(`
          INSERT INTO medicoes_espessura (
            id, equipamento_id, inspecao_id, instrumento_id, data_ensaio, norma, procedimento, equipamento_med,
            cabecote, acoplante, cert_calibracao, data_calibracao, validade_calibracao,
            metal_base, condicao_superficial, temperatura_peca, inspetor, conclusao
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          id,
          dto.equipamentoId,
          dto.inspecaoId,
          dto.instrumentoId || null,
          dto.dataEnsaio,
          dto.norma,
          dto.procedimento,
          dto.equipamentoMed,
          dto.cabecote,
          dto.acoplante,
          dto.certCalibracao,
          dto.dataCalibracao,
          dto.validadeCalibracao,
          dto.metalBase,
          dto.condicaoSuperficial,
          dto.temperaturaPeca,
          dto.inspetor,
          dto.conclusao,
        );
      }

      if (dto.pontos) {
        this.db.instance.prepare('DELETE FROM pontos_me WHERE medicao_id = ?').run(id);
        const insertPonto = this.db.instance.prepare(`
          INSERT INTO pontos_me (
            id, medicao_id, numero, regiao,
            espessura_nominal, espessura_encontrada, espessura_minima, ordem
          )
          VALUES (?,?,?,?,?,?,?,?)
        `);
        for (let i = 0; i < dto.pontos.length; i++) {
          const p = dto.pontos[i];
          insertPonto.run(
            uuidv4(),
            id,
            p.numero,
            p.regiao,
            p.espessuraNominal,
            p.espessuraEncontrada,
            p.espessuraMinima,
            i,
          );
        }
      }

      return id;
    });

    const id = tx();
    return this.findOne(id);
  }

  remove(id: string) {
    const m = this.findOne(id) as any;
    if (m.croqui_filename) {
      const filePath = join(process.cwd(), 'uploads', m.croqui_filename);
      try {
        unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare('DELETE FROM medicoes_espessura WHERE id = ?').run(id);
    return { deleted: true };
  }

  uploadCroqui(id: string, filename: string) {
    const existing = this.findOne(id) as any; // throws NotFoundException if not found
    if (existing.croqui_filename) {
      const oldPath = join(process.cwd(), 'uploads', existing.croqui_filename);
      try {
        unlinkSync(oldPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare(
      `UPDATE medicoes_espessura SET croqui_filename = ? WHERE id = ?`
    ).run(filename, id);
    return this.findOne(id);
  }

  removeCroqui(id: string) {
    const m = this.findOne(id) as any; // throws NotFoundException if not found
    if (m.croqui_filename) {
      const filePath = join(process.cwd(), 'uploads', m.croqui_filename);
      try {
        unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
      this.db.instance.prepare(
        `UPDATE medicoes_espessura SET croqui_filename = NULL WHERE id = ?`
      ).run(id);
    }
    return { deleted: true };
  }
}
