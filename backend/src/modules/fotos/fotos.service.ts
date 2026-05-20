import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FotosService {
  private uploadsDir = join(process.cwd(), 'uploads');

  constructor(private db: DatabaseService) {
    if (!existsSync(this.uploadsDir)) mkdirSync(this.uploadsDir, { recursive: true });
  }

  findByEquipamento(equipamentoId: string) {
    return this.db.instance.prepare(
      'SELECT * FROM fotos WHERE equipamento_id = ? ORDER BY numero'
    ).all(equipamentoId);
  }

  findByInspecao(inspecaoId: string) {
    return this.db.instance.prepare(
      'SELECT * FROM fotos WHERE inspecao_id = ? ORDER BY numero'
    ).all(inspecaoId);
  }

  async create(equipamentoId: string, inspecaoId: string | null, file: Express.Multer.File, legenda: string) {
    const tx = this.db.instance.transaction(() => {
      const next = (this.db.instance.prepare(
        'SELECT COALESCE(MAX(numero), 0) + 1 as n FROM fotos WHERE equipamento_id = ?'
      ).get(equipamentoId) as any).n as number;

      const id = uuidv4();
      this.db.instance.prepare(`
        INSERT INTO fotos (id, equipamento_id, inspecao_id, numero, legenda, filename, tamanho)
        VALUES (?,?,?,?,?,?,?)
      `).run(
        id,
        equipamentoId,
        inspecaoId || null,
        next,
        (legenda || '').trim(),
        file.filename,
        file.size,
      );

      return id;
    });

    const id = tx();
    return this.db.instance.prepare('SELECT * FROM fotos WHERE id = ?').get(id);
  }

  updateLegenda(id: string, legenda: string) {
    const foto = this.db.instance.prepare('SELECT * FROM fotos WHERE id = ?').get(id) as any;
    if (!foto) throw new NotFoundException('Foto não encontrada');
    this.db.instance.prepare('UPDATE fotos SET legenda = ? WHERE id = ?').run(legenda, id);
    return { ...foto, legenda };
  }

  remove(id: string) {
    const foto = this.db.instance.prepare('SELECT * FROM fotos WHERE id = ?').get(id) as any;
    if (!foto) throw new NotFoundException('Foto não encontrada');

    const tx = this.db.instance.transaction(() => {
      const filePath = join(this.uploadsDir, foto.filename);
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err;
      }

      this.db.instance.prepare('DELETE FROM fotos WHERE id = ?').run(id);

      const restantes = this.db.instance.prepare(
        'SELECT id FROM fotos WHERE equipamento_id = ? ORDER BY numero'
      ).all(foto.equipamento_id) as any[];

      const upd = this.db.instance.prepare('UPDATE fotos SET numero = ? WHERE id = ?');
      restantes.forEach((f, i) => { upd.run(i + 1, f.id); });
    });

    tx();
    return { deleted: true };
  }
}
