import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseService } from '../src/database/database.service';
import { ClientesService } from '../src/modules/clientes/clientes.service';
import { EquipamentosService } from '../src/modules/equipamentos/equipamentos.service';
import { InspecoesService } from '../src/modules/inspecoes/inspecoes.service';
import { FotosService } from '../src/modules/fotos/fotos.service';
import { calcularPrazosNR13 } from '../src/common/nr13';
import { MeService } from '../src/modules/me/me.service';
import { InstrumentosService } from '../src/modules/instrumentos/instrumentos.service';
import { RelatoriosService } from '../src/modules/relatorios/relatorios.service';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';

describe('Auditoria básica de CRUDs (smoke)', () => {
  const cwdOriginal = process.cwd();

  let workdir: string;
  let db: DatabaseService;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'nr13-test-'));
    process.chdir(workdir);

    db = new DatabaseService();
    db.onModuleInit();
  });

  afterEach(() => {
    process.chdir(cwdOriginal);
  });

  it('ClientesService.update ignora chaves não mapeadas (evita injeção via nome de coluna)', () => {
    const clientes = new ClientesService(db);
    const created = clientes.create({ nome: 'Cliente 1' }) as any;

    const updated = clientes.update(created.id, {
      nome: 'Cliente 1A',
      // @ts-expect-error - simula payload malicioso
      "nome = 'x', atualizado_em = datetime('now') --": 'AAA',
    }) as any;

    expect(updated.nome).toBe('Cliente 1A');
    expect((updated as any)["nome = 'x', atualizado_em = datetime('now') --"]).toBeUndefined();
  });

  it('InspecoesService.create persiste prox_hidro e atualiza equipamento de forma consistente', () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({
      clienteId: cli.id,
      tag: 'VP-001',
      categoria: 'V',
      dtUltimaInsp: '2026-01-01',
    }) as any;

    const ins = inspecoes.create({
      equipamentoId: eq.id,
      data: '2026-02-01',
      tipo: 'Externa',
      resultado: 'Apto',
      proxHidro: '2027-02-01',
      pmtaConfirmada: 10,
    }) as any;

    const rowInsp = db.instance.prepare('SELECT prox_hidro FROM inspecoes WHERE id = ?').get(ins.id) as any;
    expect(rowInsp.prox_hidro).toBe('2027-02-01');

    const rowEq = db.instance.prepare('SELECT prox_hidro, pmta FROM equipamentos WHERE id = ?').get(eq.id) as any;
    expect(rowEq.prox_hidro).toBe('2027-02-01');
    expect(rowEq.pmta).toBe(10);
  });

  it('InspecoesService.create usa cálculo NR-13 quando prazos não são informados', () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({
      clienteId: cli.id,
      tag: 'VP-001',
      categoria: 'V',
    }) as any;

    const data = '2026-01-01';
    const calc = calcularPrazosNR13('V', data);

    const ins = inspecoes.create({
      equipamentoId: eq.id,
      data,
      tipo: 'Externa',
      resultado: 'Apto',
    }) as any;

    const rowInsp = db.instance.prepare('SELECT prox_externo, prox_interno, prox_hidro FROM inspecoes WHERE id = ?').get(ins.id) as any;
    expect(rowInsp.prox_externo).toBe(calc.prox_externo);
    expect(rowInsp.prox_interno).toBe(calc.prox_interno);
    expect(rowInsp.prox_hidro).toBe(calc.prox_hidro);

    const rowEq = db.instance.prepare('SELECT prox_externo, prox_interno, prox_hidro FROM equipamentos WHERE id = ?').get(eq.id) as any;
    expect(rowEq.prox_externo).toBe(calc.prox_externo);
    expect(rowEq.prox_interno).toBe(calc.prox_interno);
    expect(rowEq.prox_hidro).toBe(calc.prox_hidro);
  });

  it('InspecoesService.create bloqueia prazo acima do máximo NR-13', () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({
      clienteId: cli.id,
      tag: 'VP-001',
      categoria: 'V',
    }) as any;

    expect(() => inspecoes.create({
      equipamentoId: eq.id,
      data: '2026-01-01',
      tipo: 'Externa',
      resultado: 'Apto',
      proxExterno: '2032-01-01',
    })).toThrow(/excede o máximo da NR-13/i);
  });

  it('FotosService numera sequencialmente sem depender de COUNT e mantém ordem após remoção', async () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const fotos = new FotosService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({ clienteId: cli.id, tag: 'VP-001' }) as any;

    mkdirSync(join(workdir, 'uploads'), { recursive: true });
    writeFileSync(join(workdir, 'uploads', 'a.jpg'), 'x');
    writeFileSync(join(workdir, 'uploads', 'b.jpg'), 'x');

    const f1 = await fotos.create(eq.id, null, { filename: 'a.jpg', size: 1 } as any, 'A') as any;
    const f2 = await fotos.create(eq.id, null, { filename: 'b.jpg', size: 1 } as any, 'B') as any;

    const before = db.instance.prepare('SELECT numero FROM fotos WHERE equipamento_id = ? ORDER BY numero').all(eq.id) as any[];
    expect(before.map(r => r.numero)).toEqual([1, 2]);

    fotos.remove(f1.id);
    const after = db.instance.prepare('SELECT numero FROM fotos WHERE equipamento_id = ? ORDER BY numero').all(eq.id) as any[];
    expect(after.map(r => r.numero)).toEqual([1]);

    const remaining = db.instance.prepare('SELECT id, legenda FROM fotos WHERE id = ?').get(f2.id) as any;
    expect(remaining.legenda).toBe('B');
  });

  it('FotosService.findByInspecao lista apenas fotos da inspeção selecionada', async () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);
    const fotos = new FotosService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({ clienteId: cli.id, tag: 'VP-001', categoria: 'V' }) as any;
    const ins1 = inspecoes.create({ equipamentoId: eq.id, data: '2026-01-01', tipo: 'Externa', resultado: 'Apto' }) as any;
    const ins2 = inspecoes.create({ equipamentoId: eq.id, data: '2026-02-01', tipo: 'Externa', resultado: 'Apto' }) as any;

    mkdirSync(join(workdir, 'uploads'), { recursive: true });
    writeFileSync(join(workdir, 'uploads', 'a.jpg'), 'x');
    writeFileSync(join(workdir, 'uploads', 'b.jpg'), 'x');

    await fotos.create(eq.id, ins1.id, { filename: 'a.jpg', size: 1 } as any, 'A');
    await fotos.create(eq.id, ins2.id, { filename: 'b.jpg', size: 1 } as any, 'B');

    const only1 = fotos.findByInspecao(ins1.id) as any[];
    expect(only1.length).toBe(1);
    expect(only1[0].legenda).toBe('A');
  });

  it('MeService.upsert usa inspecaoId para atualizar a mesma medição', () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);
    const me = new MeService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({ clienteId: cli.id, tag: 'VP-001' }) as any;
    const ins = inspecoes.create({ equipamentoId: eq.id, data: '2026-01-01', tipo: 'Externa', resultado: 'Apto' }) as any;

    const m1 = me.upsert({ equipamentoId: eq.id, inspecaoId: ins.id, norma: 'N-1594', pontos: [{ numero: 'P1', espessuraNominal: 10, espessuraEncontrada: 9, espessuraMinima: 8 }] }) as any;
    const m2 = me.upsert({ equipamentoId: eq.id, inspecaoId: ins.id, norma: 'N-1594', conclusao: 'OK', pontos: [{ numero: 'P1', espessuraNominal: 10, espessuraEncontrada: 9.5, espessuraMinima: 8 }] }) as any;

    expect(m2.id).toBe(m1.id);
    const row = db.instance.prepare('SELECT conclusao FROM medicoes_espessura WHERE id = ?').get(m1.id) as any;
    expect(row.conclusao).toBe('OK');
  });

  it('InspecoesService.setDispositivos persiste dispositivos de segurança e permite anexar certificado (PDF)', () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({ clienteId: cli.id, tag: 'VP-001', categoria: 'V' }) as any;
    const ins = inspecoes.create({ equipamentoId: eq.id, data: '2026-01-01', tipo: 'Externa', resultado: 'Apto' }) as any;

    const list = inspecoes.setDispositivos(ins.id, [
      { tipo: 'Válvula de segurança', descricao: 'VS-01', certificadoNumero: 'CERT-001', validadeCalibracao: '2026-12-31' },
      {},
    ]) as any[];

    expect(list.length).toBe(1);
    expect(list[0].tipo).toBe('Válvula de segurança');
    expect(list[0].descricao).toBe('VS-01');
    expect(list[0].certificado_numero).toBe('CERT-001');

    const updated = inspecoes.uploadCertificadoDispositivo(list[0].id, 'cert.pdf') as any;
    expect(updated.certificado_filename).toBe('cert.pdf');

    const cleared = inspecoes.removeCertificadoDispositivo(list[0].id) as any;
    expect(cleared.certificado_filename).toBeNull();
  });

  it('InspecoesService.addAnexosSeguranca armazena múltiplos anexos e remove com arquivo', () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({ clienteId: cli.id, tag: 'VP-001', categoria: 'V' }) as any;
    const ins = inspecoes.create({ equipamentoId: eq.id, data: '2026-01-01', tipo: 'Externa', resultado: 'Apto' }) as any;

    mkdirSync(join(workdir, 'uploads'), { recursive: true });
    writeFileSync(join(workdir, 'uploads', 'a.pdf'), '%PDF-1.4\n%EOF\n');
    writeFileSync(join(workdir, 'uploads', 'b.png'), 'x');

    const list = inspecoes.addAnexosSeguranca(ins.id, [
      { filename: 'a.pdf', originalname: 'relatorio.pdf', mimetype: 'application/pdf', size: 10 } as any,
      { filename: 'b.png', originalname: 'foto.png', mimetype: 'image/png', size: 1 } as any,
    ]) as any[];

    expect(list.length).toBe(2);

    const idToRemove = list[0].id;
    inspecoes.removeAnexoSeguranca(idToRemove);
    const remaining = inspecoes.listAnexosSeguranca(ins.id) as any[];
    expect(remaining.length).toBe(1);
  });

  it('RelatoriosService anexa automaticamente o relatório de calibração do ultrassom quando o PDF está íntegro e assinado', async () => {
    const clientes = new ClientesService(db);
    const equipamentos = new EquipamentosService(db);
    const inspecoes = new InspecoesService(db);
    const instrumentos = new InstrumentosService(db);
    const me = new MeService(db);
    const rel = new RelatoriosService(db);

    const cli = clientes.create({ nome: 'Cliente 1' }) as any;
    const eq = equipamentos.create({ clienteId: cli.id, tag: 'VP-001', categoria: 'V' }) as any;
    const ins = inspecoes.create({ equipamentoId: eq.id, data: '2026-01-01', tipo: 'Externa', resultado: 'Apto' }) as any;
    const instr = instrumentos.create({ nome: 'Ultrassom 1' }) as any;

    me.upsert({
      equipamentoId: eq.id,
      inspecaoId: ins.id,
      instrumentoId: instr.id,
      equipamentoMed: 'Ultrassom 1',
      norma: 'N-1594',
      pontos: [{ numero: 'P1', espessuraNominal: 10, espessuraEncontrada: 9, espessuraMinima: 8 }],
    } as any);

    const baseBytes = await rel.gerarPDF(eq.id, ins.id);
    const baseDoc = await PDFLibDocument.load(baseBytes);
    const basePages = baseDoc.getPageCount();

    mkdirSync(join(workdir, 'uploads'), { recursive: true });
    const certDoc = await PDFLibDocument.create();
    certDoc.addPage();
    const certBytesRaw = Buffer.from(await certDoc.save());
    const certSigned = Buffer.from(certBytesRaw.toString('latin1').replace('%%EOF', '/ByteRange [0 0 0 0]\n%%EOF'), 'latin1');
    writeFileSync(join(workdir, 'uploads', 'cert-ultrassom.pdf'), certSigned);
    instrumentos.uploadCertificado(instr.id, 'cert-ultrassom.pdf');

    const withCertBytes = await rel.gerarPDF(eq.id, ins.id);
    const withCertDoc = await PDFLibDocument.load(withCertBytes);
    const withCertPages = withCertDoc.getPageCount();

    expect(withCertPages).toBeGreaterThan(basePages);
  });
});
