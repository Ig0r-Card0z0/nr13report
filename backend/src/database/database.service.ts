import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: Database.Database;

  onModuleInit() {
    const dbDir = join(process.cwd(), 'data');
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

    this.db = new Database(join(dbDir, 'nr13.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  get instance(): Database.Database {
    return this.db;
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clientes (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        fantasia TEXT,
        cnpj TEXT,
        tel TEXT,
        email TEXT,
        cep TEXT,
        logradouro TEXT,
        numero TEXT,
        bairro TEXT,
        cidade TEXT,
        uf TEXT,
        responsavel TEXT,
        cargo TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS equipamentos (
        id TEXT PRIMARY KEY,
        cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'Vaso de Pressão',
        fabricante TEXT,
        serie TEXT,
        ano TEXT,
        posicao TEXT DEFAULT 'Vertical',
        codigo_projeto TEXT,
        local_instalacao TEXT,
        fluido TEXT,
        classe_fluido TEXT DEFAULT 'C',
        temperatura_projeto REAL,
        volume REAL,
        pressao_operacao REAL,
        pmta REAL,
        pressao_hidro REAL,
        metal_base TEXT,
        categoria TEXT,
        grupo_risco TEXT,
        dt_ultima_insp TEXT,
        tipo_ultima_insp TEXT,
        art_ultima_insp TEXT,
        prox_externo TEXT,
        prox_interno TEXT,
        prox_hidro TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inspecoes (
        id TEXT PRIMARY KEY,
        equipamento_id TEXT NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        tipo TEXT NOT NULL,
        resultado TEXT NOT NULL,
        ph_nome TEXT,
        ph_crea TEXT,
        art TEXT,
        pmta_confirmada REAL,
        prox_externo TEXT,
        prox_interno TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS fotos (
        id TEXT PRIMARY KEY,
        equipamento_id TEXT NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
        inspecao_id TEXT REFERENCES inspecoes(id) ON DELETE SET NULL,
        numero INTEGER NOT NULL,
        legenda TEXT,
        filename TEXT NOT NULL,
        tamanho INTEGER,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS medicoes_espessura (
        id TEXT PRIMARY KEY,
        equipamento_id TEXT NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
        inspecao_id TEXT REFERENCES inspecoes(id) ON DELETE SET NULL,
        data_ensaio TEXT,
        norma TEXT,
        procedimento TEXT,
        equipamento_med TEXT,
        cabecote TEXT,
        acoplante TEXT,
        cert_calibracao TEXT,
        data_calibracao TEXT,
        validade_calibracao TEXT,
        metal_base TEXT,
        condicao_superficial TEXT,
        temperatura_peca REAL,
        inspetor TEXT,
        conclusao TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pontos_me (
        id TEXT PRIMARY KEY,
        medicao_id TEXT NOT NULL REFERENCES medicoes_espessura(id) ON DELETE CASCADE,
        numero TEXT NOT NULL,
        regiao TEXT,
        espessura_nominal REAL,
        espessura_encontrada REAL,
        espessura_minima REAL,
        ordem INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS profissionais (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        crea TEXT,
        email TEXT,
        telefone TEXT,
        especialidade TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS instrumentos_medicao (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT,
        fabricante TEXT,
        modelo TEXT,
        serie TEXT,
        certificado_numero TEXT,
        certificado_filename TEXT,
        data_calibracao TEXT,
        validade_calibracao TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inspecao_instrumentos (
        inspecao_id TEXT NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
        instrumento_id TEXT NOT NULL REFERENCES instrumentos_medicao(id) ON DELETE CASCADE,
        PRIMARY KEY (inspecao_id, instrumento_id)
      );

      CREATE TABLE IF NOT EXISTS inspecao_dispositivos_seguranca (
        id TEXT PRIMARY KEY,
        inspecao_id TEXT NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
        tipo TEXT,
        descricao TEXT,
        fabricante TEXT,
        modelo TEXT,
        serie TEXT,
        certificado_numero TEXT,
        certificado_filename TEXT,
        data_calibracao TEXT,
        validade_calibracao TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS inspecao_anexos_seguranca (
        id TEXT PRIMARY KEY,
        inspecao_id TEXT NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
        descricao TEXT,
        nome_original TEXT,
        filename TEXT NOT NULL,
        mimetype TEXT,
        tamanho INTEGER,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_equip_cliente ON equipamentos(cliente_id);
      CREATE INDEX IF NOT EXISTS idx_insp_equip ON inspecoes(equipamento_id);
      CREATE INDEX IF NOT EXISTS idx_insp_equip_data ON inspecoes(equipamento_id, data);
      CREATE INDEX IF NOT EXISTS idx_fotos_equip ON fotos(equipamento_id);
      CREATE INDEX IF NOT EXISTS idx_fotos_equip_numero ON fotos(equipamento_id, numero);
      CREATE INDEX IF NOT EXISTS idx_fotos_inspecao ON fotos(inspecao_id);
      CREATE INDEX IF NOT EXISTS idx_me_equip ON medicoes_espessura(equipamento_id);
      CREATE INDEX IF NOT EXISTS idx_me_inspecao ON medicoes_espessura(inspecao_id);
      CREATE INDEX IF NOT EXISTS idx_pontos_me ON pontos_me(medicao_id);
      CREATE INDEX IF NOT EXISTS idx_insp_instr ON inspecao_instrumentos(inspecao_id);
      CREATE INDEX IF NOT EXISTS idx_insp_disp ON inspecao_dispositivos_seguranca(inspecao_id);
      CREATE INDEX IF NOT EXISTS idx_insp_anexos_seg ON inspecao_anexos_seguranca(inspecao_id);
      CREATE INDEX IF NOT EXISTS idx_instr_validade ON instrumentos_medicao(validade_calibracao);
      CREATE INDEX IF NOT EXISTS idx_prof_nome_crea ON profissionais(nome, crea);
    `);

    // Migrations incrementais — cada ALTER TABLE em try/catch próprio
    this.addColumnIfMissing('medicoes_espessura', 'croqui_filename', 'TEXT');
    this.addColumnIfMissing('equipamentos', 'foto_capa_id', 'TEXT REFERENCES fotos(id) ON DELETE SET NULL');
    this.addColumnIfMissing('inspecoes', 'art_filename', 'TEXT');
    this.addColumnIfMissing('inspecoes', 'prox_hidro', 'TEXT');
    this.addColumnIfMissing('inspecoes', 'prazo_complementos', 'TEXT');
    this.addColumnIfMissing('clientes', 'profissional_id', 'TEXT REFERENCES profissionais(id) ON DELETE SET NULL');
    this.addColumnIfMissing('clientes', 'logo_filename', 'TEXT');
    this.addColumnIfMissing('medicoes_espessura', 'instrumento_id', 'TEXT REFERENCES instrumentos_medicao(id) ON DELETE SET NULL');

    // Bootstrap inicial: para cada combinação distinta de (ph_nome, ph_crea)
    // já existente em inspecoes, criar um Profissional correspondente.
    // Idempotente — só insere se ainda não houver match por nome+crea.
    this.bootstrapProfissionais();
  }

  private bootstrapProfissionais() {
    const existentes = this.db.prepare(
      `SELECT DISTINCT ph_nome AS nome, COALESCE(ph_crea,'') AS crea
       FROM inspecoes
       WHERE ph_nome IS NOT NULL AND TRIM(ph_nome) <> ''`,
    ).all() as { nome: string; crea: string }[];

    if (!existentes.length) return;

    const insert = this.db.prepare(
      `INSERT INTO profissionais (id, nome, crea) VALUES (?, ?, ?)`,
    );
    const exists = this.db.prepare(
      `SELECT 1 FROM profissionais WHERE nome = ? AND COALESCE(crea,'') = ?`,
    );

    // crypto.randomUUID is available since Node 14.17 / 16+
    const uuid = (): string =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('crypto').randomUUID();

    for (const row of existentes) {
      const nome = row.nome.trim();
      if (!nome) continue;
      const crea = (row.crea || '').trim();
      if (exists.get(nome, crea)) continue;
      insert.run(uuid(), nome, crea || null);
    }
  }

  private addColumnIfMissing(table: string, column: string, definition: string) {
    try {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes('duplicate column name')) {
        throw err;
      }
    }
  }
}