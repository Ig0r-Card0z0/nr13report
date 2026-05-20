import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { calcularPrazosNR13 } from '../../common/nr13';

export interface CreateInspecaoDto {
  equipamentoId: string;
  data: string;
  tipo: string;
  resultado: string;
  phNome?: string;
  phCrea?: string;
  art?: string;
  pmtaConfirmada?: number;
  proxExterno?: string;
  proxInterno?: string;
  proxHidro?: string;
  prazoComplementos?: string;
  observacoes?: string;
}

export interface DispositivoSegurancaDto {
  tipo?: string;
  descricao?: string;
  fabricante?: string;
  modelo?: string;
  serie?: string;
  certificadoNumero?: string;
  dataCalibracao?: string;
  validadeCalibracao?: string;
  observacoes?: string;
}

@Injectable()
export class InspecoesService {
  constructor(private db: DatabaseService) {}

  findByEquipamento(equipamentoId: string) {
    const rows = this.db.instance.prepare(`
      SELECT i.*,
        (SELECT COUNT(*) FROM fotos WHERE inspecao_id = i.id) as total_fotos,
        (SELECT COUNT(*) FROM pontos_me p
           JOIN medicoes_espessura m ON m.id = p.medicao_id
           WHERE m.inspecao_id = i.id) as total_pontos_me,
        (CASE WHEN i.art_filename IS NOT NULL THEN 1 ELSE 0 END) as tem_art
      FROM inspecoes i
      WHERE i.equipamento_id = ?
      ORDER BY i.data DESC
    `).all(equipamentoId) as any[];
    return rows.map(r => ({ ...r, instrumentos: this.findInstrumentos(r.id), dispositivos: this.findDispositivos(r.id) }));
  }

  findOne(id: string) {
    const i = this.db.instance.prepare('SELECT * FROM inspecoes WHERE id = ?').get(id) as any;
    if (!i) throw new NotFoundException('Inspeção não encontrada');
    return { ...i, instrumentos: this.findInstrumentos(id), dispositivos: this.findDispositivos(id) };
  }

  private findInstrumentos(inspecaoId: string) {
    return this.db.instance.prepare(`
      SELECT im.*
      FROM inspecao_instrumentos ii
      JOIN instrumentos_medicao im ON im.id = ii.instrumento_id
      WHERE ii.inspecao_id = ?
      ORDER BY im.nome
    `).all(inspecaoId);
  }

  private findDispositivos(inspecaoId: string) {
    return this.db.instance.prepare(`
      SELECT * FROM inspecao_dispositivos_seguranca
      WHERE inspecao_id = ?
      ORDER BY criado_em ASC
    `).all(inspecaoId);
  }

  create(dto: CreateInspecaoDto) {
    if (!dto.data) throw new BadRequestException('Data da inspeção é obrigatória.');

    const tx = this.db.instance.transaction(() => {
      // Busca categoria do equipamento para auto-calcular prazos NR-13 que não vierem no DTO
      const eq = this.db.instance.prepare(
        `SELECT categoria FROM equipamentos WHERE id = ?`,
      ).get(dto.equipamentoId) as any;
      if (!eq) throw new NotFoundException('Equipamento não encontrado.');

      const calc = calcularPrazosNR13(eq.categoria, dto.data);

      // Override-friendly: respeita valor vindo do DTO; caso contrário usa cálculo NR-13.
      const proxExterno = dto.proxExterno !== undefined && dto.proxExterno !== ''
        ? dto.proxExterno : calc.prox_externo;
      const proxInterno = dto.proxInterno !== undefined && dto.proxInterno !== ''
        ? dto.proxInterno : calc.prox_interno;
      const proxHidro = dto.proxHidro !== undefined && dto.proxHidro !== ''
        ? dto.proxHidro : calc.prox_hidro;

      // Validação: prazos não podem ser anteriores à data da inspeção
      this.validarPrazo('externo', proxExterno, dto.data);
      this.validarPrazo('interno', proxInterno, dto.data);
      this.validarPrazo('hidrostático', proxHidro, dto.data);
      // Validação: não exceder periodicidade máxima NR-13 da categoria do equipamento
      this.validarMaxNR13('externo', proxExterno, calc.prox_externo, eq.categoria);
      this.validarMaxNR13('interno', proxInterno, calc.prox_interno, eq.categoria);
      this.validarMaxNR13('hidrostático', proxHidro, calc.prox_hidro, eq.categoria);

      const id = uuidv4();
      try {
        this.db.instance.prepare(`
          INSERT INTO inspecoes (
            id, equipamento_id, data, tipo, resultado,
            ph_nome, ph_crea, art, pmta_confirmada,
            prox_externo, prox_interno, prox_hidro, prazo_complementos, observacoes
          )
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          id,
          dto.equipamentoId,
          dto.data,
          dto.tipo,
          dto.resultado,
          dto.phNome,
          dto.phCrea,
          dto.art,
          dto.pmtaConfirmada,
          proxExterno,
          proxInterno,
          proxHidro,
          dto.prazoComplementos || null,
          dto.observacoes,
        );
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (!msg.includes('no column named prox_hidro') && !msg.includes('no column named prazo_complementos')) throw err;
        this.db.instance.prepare(`
          INSERT INTO inspecoes (
            id, equipamento_id, data, tipo, resultado,
            ph_nome, ph_crea, art, pmta_confirmada,
            prox_externo, prox_interno, observacoes
          )
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          id,
          dto.equipamentoId,
          dto.data,
          dto.tipo,
          dto.resultado,
          dto.phNome,
          dto.phCrea,
          dto.art,
          dto.pmtaConfirmada,
          proxExterno,
          proxInterno,
          dto.observacoes,
        );
      }

      this.db.instance.prepare(`
        UPDATE equipamentos SET
          dt_ultima_insp = ?,
          tipo_ultima_insp = ?,
          art_ultima_insp = ?,
          prox_externo = ?,
          prox_interno = ?,
          prox_hidro = ?,
          pmta = COALESCE(?, pmta),
          atualizado_em = datetime('now')
        WHERE id = ?
      `).run(
        dto.data,
        dto.tipo,
        dto.art || null,
        proxExterno || null,
        proxInterno || null,
        proxHidro || null,
        dto.pmtaConfirmada ?? null,
        dto.equipamentoId,
      );

      return id;
    });

    const id = tx();
    return this.findOne(id);
  }

  private validarPrazo(rotulo: string, prazo: string | null | undefined, dataInsp: string) {
    if (!prazo) return;
    const p = String(prazo).slice(0, 10);
    const d = String(dataInsp).slice(0, 10);
    if (p < d) {
      throw new BadRequestException(
        `A próxima inspeção (${rotulo}) não pode ser anterior à data da inspeção atual (${d}).`,
      );
    }
  }

  private validarMaxNR13(
    rotulo: string,
    prazo: string | null | undefined,
    maxNr13: string | null | undefined,
    categoria: string | null | undefined,
  ) {
    if (!prazo || !maxNr13) return;
    const p = String(prazo).slice(0, 10);
    const m = String(maxNr13).slice(0, 10);
    if (p > m) {
      throw new BadRequestException(
        `O prazo da próxima inspeção (${rotulo}) excede o máximo da NR-13 para a categoria ${categoria} (até ${m}).`,
      );
    }
  }

  remove(id: string) {
    const ins = this.db.instance.prepare('SELECT art_filename FROM inspecoes WHERE id = ?').get(id) as any;
    if (!ins) throw new NotFoundException('Inspeção não encontrada');
    if (ins.art_filename) {
      const filePath = join(process.cwd(), 'uploads', ins.art_filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    const dispFiles = this.db.instance.prepare(
      `SELECT certificado_filename FROM inspecao_dispositivos_seguranca WHERE inspecao_id = ? AND certificado_filename IS NOT NULL`,
    ).all(id) as any[];
    for (const row of dispFiles) {
      const filename = row.certificado_filename;
      if (!filename) continue;
      const filePath = join(process.cwd(), 'uploads', filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    const anexosFiles = this.db.instance.prepare(
      `SELECT filename FROM inspecao_anexos_seguranca WHERE inspecao_id = ? AND filename IS NOT NULL`,
    ).all(id) as any[];
    for (const row of anexosFiles) {
      const filename = row.filename;
      if (!filename) continue;
      const filePath = join(process.cwd(), 'uploads', filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare('DELETE FROM inspecoes WHERE id = ?').run(id);
    return { deleted: true };
  }

  uploadArt(id: string, filename: string) {
    const ins = this.db.instance.prepare('SELECT art_filename FROM inspecoes WHERE id = ?').get(id) as any;
    if (!ins) throw new NotFoundException('Inspeção não encontrada');
    if (ins.art_filename) {
      const oldPath = join(process.cwd(), 'uploads', ins.art_filename);
      try {
        if (existsSync(oldPath)) unlinkSync(oldPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare(`UPDATE inspecoes SET art_filename = ? WHERE id = ?`).run(filename, id);
    return this.findOne(id);
  }

  removeArt(id: string) {
    const ins = this.db.instance.prepare('SELECT art_filename FROM inspecoes WHERE id = ?').get(id) as any;
    if (!ins) throw new NotFoundException('Inspeção não encontrada');
    if (ins.art_filename) {
      const filePath = join(process.cwd(), 'uploads', ins.art_filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
      this.db.instance.prepare(`UPDATE inspecoes SET art_filename = NULL WHERE id = ?`).run(id);
    }
    return this.findOne(id);
  }

  setInstrumentos(id: string, instrumentoIds: string[]) {
    this.findOne(id); // valida existência
    const tx = this.db.instance.transaction((ids: string[]) => {
      this.db.instance.prepare(`DELETE FROM inspecao_instrumentos WHERE inspecao_id = ?`).run(id);
      const insert = this.db.instance.prepare(
        `INSERT OR IGNORE INTO inspecao_instrumentos (inspecao_id, instrumento_id) VALUES (?, ?)`,
      );
      for (const iid of ids) insert.run(id, iid);
    });
    tx(instrumentoIds || []);
    return this.findOne(id);
  }

  setDispositivos(inspecaoId: string, dispositivos: DispositivoSegurancaDto[]) {
    this.findOne(inspecaoId);
    const tx = this.db.instance.transaction((list: DispositivoSegurancaDto[]) => {
      this.db.instance.prepare(`DELETE FROM inspecao_dispositivos_seguranca WHERE inspecao_id = ?`).run(inspecaoId);
      const insert = this.db.instance.prepare(`
        INSERT INTO inspecao_dispositivos_seguranca (
          id, inspecao_id, tipo, descricao, fabricante, modelo, serie,
          certificado_numero, data_calibracao, validade_calibracao, observacoes
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `);
      const created: any[] = [];
      for (const d of list || []) {
        if (!d) continue;
        const anyField = [d.tipo, d.descricao, d.fabricante, d.modelo, d.serie, d.certificadoNumero, d.dataCalibracao, d.validadeCalibracao, d.observacoes]
          .some(v => typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null);
        if (!anyField) continue;
        const id = uuidv4();
        insert.run(
          id,
          inspecaoId,
          d.tipo || null,
          d.descricao || null,
          d.fabricante || null,
          d.modelo || null,
          d.serie || null,
          d.certificadoNumero || null,
          d.dataCalibracao || null,
          d.validadeCalibracao || null,
          d.observacoes || null,
        );
        created.push({ id });
      }
      return created;
    });
    tx(dispositivos || []);
    return this.findDispositivos(inspecaoId);
  }

  uploadCertificadoDispositivo(id: string, filename: string) {
    const row = this.db.instance.prepare(
      `SELECT certificado_filename FROM inspecao_dispositivos_seguranca WHERE id = ?`,
    ).get(id) as any;
    if (!row) throw new NotFoundException('Dispositivo não encontrado');
    if (row.certificado_filename) {
      const oldPath = join(process.cwd(), 'uploads', row.certificado_filename);
      try {
        if (existsSync(oldPath)) unlinkSync(oldPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare(
      `UPDATE inspecao_dispositivos_seguranca SET certificado_filename = ? WHERE id = ?`,
    ).run(filename, id);
    return this.db.instance.prepare(`SELECT * FROM inspecao_dispositivos_seguranca WHERE id = ?`).get(id);
  }

  removeCertificadoDispositivo(id: string) {
    const row = this.db.instance.prepare(
      `SELECT certificado_filename FROM inspecao_dispositivos_seguranca WHERE id = ?`,
    ).get(id) as any;
    if (!row) throw new NotFoundException('Dispositivo não encontrado');
    if (row.certificado_filename) {
      const filePath = join(process.cwd(), 'uploads', row.certificado_filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
      this.db.instance.prepare(
        `UPDATE inspecao_dispositivos_seguranca SET certificado_filename = NULL WHERE id = ?`,
      ).run(id);
    }
    return this.db.instance.prepare(`SELECT * FROM inspecao_dispositivos_seguranca WHERE id = ?`).get(id);
  }

  listAnexosSeguranca(inspecaoId: string) {
    this.findOne(inspecaoId);
    return this.db.instance.prepare(`
      SELECT *
      FROM inspecao_anexos_seguranca
      WHERE inspecao_id = ?
      ORDER BY criado_em DESC
    `).all(inspecaoId);
  }

  addAnexosSeguranca(inspecaoId: string, files: Express.Multer.File[]) {
    this.findOne(inspecaoId);
    const tx = this.db.instance.transaction((list: Express.Multer.File[]) => {
      const insert = this.db.instance.prepare(`
        INSERT INTO inspecao_anexos_seguranca (
          id, inspecao_id, descricao, nome_original, filename, mimetype, tamanho
        ) VALUES (?,?,?,?,?,?,?)
      `);
      const created: any[] = [];
      for (const f of list || []) {
        if (!f?.filename) continue;
        const id = uuidv4();
        insert.run(
          id,
          inspecaoId,
          null,
          f.originalname || null,
          f.filename,
          f.mimetype || null,
          f.size ?? null,
        );
        created.push({ id });
      }
      return created;
    });
    tx(files || []);
    return this.listAnexosSeguranca(inspecaoId);
  }

  removeAnexoSeguranca(id: string) {
    const row = this.db.instance.prepare(
      `SELECT filename FROM inspecao_anexos_seguranca WHERE id = ?`,
    ).get(id) as any;
    if (!row) throw new NotFoundException('Anexo não encontrado');
    if (row.filename) {
      const filePath = join(process.cwd(), 'uploads', row.filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
    this.db.instance.prepare(`DELETE FROM inspecao_anexos_seguranca WHERE id = ?`).run(id);
    return { deleted: true };
  }
}
