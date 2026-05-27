import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { calcularPrazosNR13 } from '../../common/nr13';

/** Detecta se o tipo de equipamento se refere a uma caldeira (NR-13 13.4). */
function tipoEhCaldeira(tipo: string | null | undefined): boolean {
  return /caldeira/i.test(String(tipo || ''));
}

export interface CreateEquipamentoDto {
  clienteId: string;
  tag: string;
  tipo?: string;
  fabricante?: string;
  serie?: string;
  ano?: string;
  posicao?: string;
  codigoProjeto?: string;
  localInstalacao?: string;
  fluido?: string;
  classeFluido?: string;
  temperaturaProj?: number;
  volume?: number;
  pressaoOperacao?: number;
  pmta?: number;
  pressaoHidro?: number;
  metalBase?: string;
  categoria?: string;
  grupoRisco?: string;
  dtUltimaInsp?: string;
  tipoUltimaInsp?: string;
  artUltimaInsp?: string;
  proxExterno?: string;
  proxInterno?: string;
  proxHidro?: string;
  /** Caldeira de recuperação de álcalis — REQ-01.2 (prazo 15 meses). */
  recuperacaoAlcalis?: boolean;
}

@Injectable()
export class EquipamentosService {
  constructor(private db: DatabaseService) {}

  findAll(clienteId?: string) {
    if (clienteId) {
      return this.db.instance.prepare(`
        SELECT e.*, c.nome as cliente_nome, c.possui_spie as cliente_possui_spie,
          (SELECT COUNT(*) FROM inspecoes WHERE equipamento_id = e.id) as total_inspecoes,
          (SELECT COUNT(*) FROM fotos WHERE equipamento_id = e.id) as total_fotos
        FROM equipamentos e
        LEFT JOIN clientes c ON c.id = e.cliente_id
        WHERE e.cliente_id = ?
        ORDER BY e.tag
      `).all(clienteId);
    }
    return this.db.instance.prepare(`
      SELECT e.*, c.nome as cliente_nome, c.possui_spie as cliente_possui_spie,
        (SELECT COUNT(*) FROM inspecoes WHERE equipamento_id = e.id) as total_inspecoes,
        (SELECT COUNT(*) FROM fotos WHERE equipamento_id = e.id) as total_fotos
      FROM equipamentos e
      LEFT JOIN clientes c ON c.id = e.cliente_id
      ORDER BY c.nome, e.tag
    `).all();
  }

  findOne(id: string) {
    const eq = this.db.instance.prepare(`
      SELECT e.*, c.nome as cliente_nome, c.cnpj as cliente_cnpj,
        c.logradouro, c.numero, c.bairro, c.cidade, c.uf,
        c.possui_spie as cliente_possui_spie
      FROM equipamentos e
      LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE e.id = ?
    `).get(id);
    if (!eq) throw new NotFoundException('Equipamento não encontrado');
    return eq;
  }

  create(dto: CreateEquipamentoDto) {
    const id = uuidv4();
    const cli = this.db.instance.prepare(
      `SELECT possui_spie FROM clientes WHERE id = ?`,
    ).get(dto.clienteId) as any;
    const prazos = this.completarPrazos(dto.categoria, dto.dtUltimaInsp, {
      prox_externo: dto.proxExterno,
      prox_interno: dto.proxInterno,
      prox_hidro:   dto.proxHidro,
    }, {
      comSpie: !!cli?.possui_spie,
      tipoEquipamento: tipoEhCaldeira(dto.tipo) ? 'caldeira' : 'vaso',
      opcoesCaldeira: { recuperacaoAlcalis: !!dto.recuperacaoAlcalis },
    });
    this.db.instance.prepare(`
      INSERT INTO equipamentos (
        id, cliente_id, tag, tipo, fabricante, serie, ano, posicao, codigo_projeto,
        local_instalacao, fluido, classe_fluido, temperatura_projeto, volume,
        pressao_operacao, pmta, pressao_hidro, metal_base, categoria, grupo_risco,
        dt_ultima_insp, tipo_ultima_insp, art_ultima_insp, prox_externo, prox_interno, prox_hidro,
        recuperacao_alcalis
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, dto.clienteId, dto.tag, dto.tipo || 'Vaso de Pressão',
      dto.fabricante, dto.serie, dto.ano, dto.posicao || 'Vertical',
      dto.codigoProjeto, dto.localInstalacao, dto.fluido, dto.classeFluido || 'C',
      dto.temperaturaProj, dto.volume, dto.pressaoOperacao, dto.pmta,
      dto.pressaoHidro, dto.metalBase, dto.categoria, dto.grupoRisco,
      dto.dtUltimaInsp, dto.tipoUltimaInsp, dto.artUltimaInsp,
      prazos.prox_externo, prazos.prox_interno, prazos.prox_hidro,
      dto.recuperacaoAlcalis ? 1 : 0,
    );
    return this.findOne(id);
  }

  /**
   * Quando o front não envia explicitamente prox_externo / prox_interno / prox_hidro
   * e há categoria + data da última inspeção, completa os prazos com base na NR-13.
   * Valor explícito do front (mesmo string vazia) é respeitado como override do engenheiro.
   */
  private completarPrazos(
    categoria: string | undefined,
    dtUltimaInsp: string | undefined,
    explicit: { prox_externo?: string; prox_interno?: string; prox_hidro?: string },
    opts: import('../../common/nr13').OpcoesCalculoPrazo = {},
  ) {
    const calc = calcularPrazosNR13(categoria, dtUltimaInsp, opts);
    return {
      prox_externo: explicit.prox_externo !== undefined ? explicit.prox_externo : calc.prox_externo,
      prox_interno: explicit.prox_interno !== undefined ? explicit.prox_interno : calc.prox_interno,
      prox_hidro:   explicit.prox_hidro   !== undefined ? explicit.prox_hidro   : calc.prox_hidro,
    };
  }

  update(id: string, dto: Partial<CreateEquipamentoDto>) {
    const atual = this.findOne(id) as any;
    const map: Record<string, string> = {
      clienteId: 'cliente_id', tag: 'tag', tipo: 'tipo', fabricante: 'fabricante',
      serie: 'serie', ano: 'ano', posicao: 'posicao', codigoProjeto: 'codigo_projeto',
      localInstalacao: 'local_instalacao', fluido: 'fluido', classeFluido: 'classe_fluido',
      temperaturaProj: 'temperatura_projeto', volume: 'volume', pressaoOperacao: 'pressao_operacao',
      pmta: 'pmta', pressaoHidro: 'pressao_hidro', metalBase: 'metal_base',
      categoria: 'categoria', grupoRisco: 'grupo_risco', dtUltimaInsp: 'dt_ultima_insp',
      tipoUltimaInsp: 'tipo_ultima_insp', artUltimaInsp: 'art_ultima_insp',
      proxExterno: 'prox_externo', proxInterno: 'prox_interno', proxHidro: 'prox_hidro',
      recuperacaoAlcalis: 'recuperacao_alcalis',
    };

    // Auto-completa prazos NR-13 quando o front não envia explicitamente
    // mas atualiza categoria ou data da última inspeção.
    const tocouCategoria   = dto.categoria !== undefined;
    const tocouDtInsp      = dto.dtUltimaInsp !== undefined;
    const enviouAlgumPrazo =
      dto.proxExterno !== undefined ||
      dto.proxInterno !== undefined ||
      dto.proxHidro   !== undefined;

    if ((tocouCategoria || tocouDtInsp) && !enviouAlgumPrazo) {
      const cat = tocouCategoria ? dto.categoria : atual.categoria;
      const dtIns = tocouDtInsp ? dto.dtUltimaInsp : atual.dt_ultima_insp;
      const tipo = dto.tipo !== undefined ? dto.tipo : atual.tipo;
      const recAlc = dto.recuperacaoAlcalis !== undefined
        ? dto.recuperacaoAlcalis : !!atual.recuperacao_alcalis;
      const cli = this.db.instance.prepare(
        `SELECT possui_spie FROM clientes WHERE id = ?`,
      ).get(atual.cliente_id) as any;
      const calc = calcularPrazosNR13(cat, dtIns, {
        comSpie: !!cli?.possui_spie,
        tipoEquipamento: tipoEhCaldeira(tipo) ? 'caldeira' : 'vaso',
        opcoesCaldeira: { recuperacaoAlcalis: !!recAlc },
      });
      if (calc.prox_externo) dto = { ...dto, proxExterno: calc.prox_externo };
      if (calc.prox_interno) dto = { ...dto, proxInterno: calc.prox_interno };
      if (calc.prox_hidro)   dto = { ...dto, proxHidro:   calc.prox_hidro };
    }

    const sets: string[] = [];
    const vals: any[] = [];
    Object.entries(dto).forEach(([k, v]) => {
      if (!map[k] || v === undefined) return;
      sets.push(`${map[k]} = ?`);
      if (k === 'recuperacaoAlcalis') vals.push(v ? 1 : 0);
      else vals.push(v);
    });
    if (!sets.length) return this.findOne(id);
    this.db.instance.prepare(
      `UPDATE equipamentos SET ${sets.join(', ')}, atualizado_em = datetime('now') WHERE id = ?`
    ).run(...vals, id);
    return this.findOne(id);
  }

  setFotoCapa(id: string, fotoId: string | null) {
    this.findOne(id);
    if (fotoId) {
      const foto = this.db.instance.prepare(
        `SELECT equipamento_id FROM fotos WHERE id = ?`,
      ).get(fotoId) as any;
      if (!foto) throw new NotFoundException('Foto não encontrada');
      if (foto.equipamento_id !== id) {
        throw new BadRequestException('A foto não pertence a este equipamento.');
      }
    }
    this.db.instance.prepare(
      `UPDATE equipamentos SET foto_capa_id = ?, atualizado_em = datetime('now') WHERE id = ?`,
    ).run(fotoId, id);
    return this.findOne(id);
  }

  remove(id: string) {
    this.findOne(id);
    this.db.instance.prepare('DELETE FROM equipamentos WHERE id = ?').run(id);
    return { deleted: true };
  }

  findVencimentos(dias = 90) {
    return this.db.instance.prepare(`
      SELECT e.*, c.nome as cliente_nome
      FROM equipamentos e
      LEFT JOIN clientes c ON c.id = e.cliente_id
      WHERE e.prox_externo IS NOT NULL
        AND julianday(e.prox_externo) - julianday('now') <= ?
      ORDER BY e.prox_externo
    `).all(dias);
  }
}
