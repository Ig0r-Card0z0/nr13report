/**
 * Gerador de relatório de inspeção NR-13 em formato Word (.docx).
 *
 * Réplica fiel do PDF produzido por relatorios.service.ts → gerarPDF():
 * mesma capa, mesmas ~20 seções, mesmos checklists e tabelas, mesma
 * conclusão com bloco de assinatura. Recebe os dados já carregados e
 * pré-processados pelo service (equipamento, inspeção, medições, fotos
 * normalizadas, instrumentos) e devolve um Buffer .docx.
 *
 * Dependência: `docx` (npm install docx).
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlignTable, ImageRun, PageNumber, PageBreak,
} from 'docx';
import {
  ResultadoOverrides, resolverSim, resolverTipoInspecao, resolverDataRecPH, resolverObs,
  obsConclusaoTipo, TipoInspecaoMarcado,
} from './resultado-overrides';

// ─── Cores da marca NORT.END (hex sem #, como o docx exige) ──────────────────
const K = {
  azul:    '0A2F3F',
  azulM:   '114B66',
  azulC:   'D7E7EF',
  laranja: 'E07000',
  cinzaH:  'D9D9D9',
  cinzaL:  'F4F4F4',
  verdeH:  '375623',
  branco:  'FFFFFF',
  preto:   '000000',
  cinzaT:  '595959',
  secaoBg: 'F7F7F7',
  vermelhoL: 'FFCCCC',
};

// ─── Layout (US Letter? Não — A4, como o PDF) ────────────────────────────────
// A4 em DXA: 11906 x 16838. Margens de 15 mm ≈ 850 DXA.
const PAGE_W = 11906;
const MARGIN = 850;
const CONTENT_W = PAGE_W - 2 * MARGIN; // ≈ 10206 DXA

// ─── Tipos de entrada (espelham o que o service já carrega) ──────────────────
export interface DocxInput {
  eq: any;
  insp: any;
  me: any;
  pontos: any[];
  instrumentos: any[];
  fotosPrep: { buffer: Buffer | null; w: number; h: number; legenda: string; numero: number }[];
  capaPrep: { buffer: Buffer; w: number; h: number; legenda: string } | null;
  clienteLogoPrep: { buffer: Buffer; w: number; h: number } | null;
  docsGerados: string[];        // linhas da seção 5.2 já montadas pelo service
  logoNortendBuffer: Buffer | null; // assets/logo_nortend.png, se existir
  overrides: ResultadoOverrides;    // sobrescritas manuais da seção 4 (vazio = defaults)
  derivados: {
    pmta: number; vol: number; pvMpa: number; cat: string; grp: string;
    classe: string; dtInsp: string; phNome: string; phCrea: string;
    art: string; numRel: string;
  };
}

// ─── Helpers de formatação (idênticos aos do service) ────────────────────────
function fdt(s?: string | null): string {
  if (!s) return '—';
  const dateStr = String(s).trim().slice(0, 10);
  if (!dateStr || dateStr.length < 10) return '—';
  const d = dateStr.split('-');
  return d.length === 3 && d[0].length === 4 ? `${d[2]}/${d[1]}/${d[0]}` : '—';
}
function fn(v: any, dec = 2): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(dec);
}

// ─── Builders de parágrafo / célula reutilizáveis ────────────────────────────
const FONT = 'Helvetica';

function t(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text, font: FONT, bold: opts.bold,
    size: (opts.size ?? 9) * 2,            // docx usa half-points
    color: opts.color ?? K.preto,
  });
}

/** Parágrafo de texto corrido justificado (replica o helper `texto`). */
function paraTexto(text: string) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 264 },
    children: [t(text, { size: 10 })],
  });
}

/** Barra de seção: faixa cinza com borda laranja embaixo (replica `secao`). */
function barraSecao(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: K.secaoBg, color: 'auto' },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: K.laranja, space: 4 } },
    children: [t(label.toUpperCase(), { bold: true, size: 10, color: K.cinzaT })],
  });
}

/** Sub-título de bloco (replica `subSecao`). */
function subSecao(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 80 },
    children: [t(label, { bold: true, size: 10, color: K.azulM })],
  });
}

const BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'AAAAAA' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
                  insideHorizontal: BORDER, insideVertical: BORDER };
const CELL_MARGIN = { top: 60, bottom: 60, left: 90, right: 90 };

function cell(children: Paragraph[], opts: {
  width: number; fill?: string; span?: number;
  valign?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable];
}): TableCell {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.span,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    verticalAlign: opts.valign ?? VerticalAlignTable.CENTER,
    margins: CELL_MARGIN,
    children,
  });
}

function pCell(text: string, o: { bold?: boolean; size?: number; align?: any; color?: string } = {}) {
  return new Paragraph({
    alignment: o.align,
    children: [t(text, { bold: o.bold, size: o.size ?? 9, color: o.color })],
  });
}

/**
 * Tabela chave|valor de 4 colunas (replica `kvRow`): label cinza + valor,
 * dois pares por linha.
 */
function tabelaKV(pairs: [string, string][]): Table {
  const cw = Math.floor(CONTENT_W / 4);
  const rows: TableRow[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const cells: TableCell[] = [
      cell([pCell(pairs[i][0], { bold: true })], { width: cw, fill: K.cinzaH }),
      cell([pCell(pairs[i][1] || '—')], { width: cw }),
    ];
    if (pairs[i + 1]) {
      cells.push(
        cell([pCell(pairs[i + 1][0], { bold: true })], { width: cw, fill: K.cinzaH }),
        cell([pCell(pairs[i + 1][1] || '—')], { width: cw }),
      );
    } else {
      cells.push(cell([pCell('')], { width: cw * 2, span: 2 }));
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [cw, cw, cw, cw],
    borders: BORDERS,
    rows,
  });
}

/**
 * Tabela de checklist (replica `chkHdr` + `chkItem`): Nº | Descrição |
 * Resultado | Observações, com linhas zebradas e marcação (x)/( ).
 */
function tabelaChecklist(itens: { n: number; desc: string; sim: boolean; obs?: string }[]): Table {
  const cw = [
    Math.floor(CONTENT_W * 0.06),
    Math.floor(CONTENT_W * 0.52),
    Math.floor(CONTENT_W * 0.14),
    Math.floor(CONTENT_W * 0.28),
  ];
  cw[3] = CONTENT_W - cw[0] - cw[1] - cw[2];

  const header = new TableRow({
    tableHeader: true,
    children: ['Nº', 'Descrição', 'Resultado', 'Observações'].map((h, i) =>
      cell([pCell(h, { bold: true, size: 9, align: AlignmentType.CENTER, color: K.branco })],
        { width: cw[i], fill: K.azul }),
    ),
  });

  const rows = itens.map((it, idx) => {
    const bg = idx % 2 === 0 ? K.branco : K.cinzaL;
    const resultado = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        t(it.sim ? '(x) Sim' : '( ) Sim', { size: 9 }),
        new TextRun({ text: '', break: 1 }),
        t(it.sim ? '( ) Não' : '(x) Não', { size: 9 }),
      ],
    });
    return new TableRow({
      children: [
        cell([pCell(String(it.n), { align: AlignmentType.CENTER })], { width: cw[0], fill: bg }),
        cell([pCell(it.desc)], { width: cw[1], fill: bg, valign: VerticalAlignTable.TOP }),
        cell([resultado], { width: cw[2], fill: bg }),
        cell([pCell(it.obs || '')], { width: cw[3], fill: bg, valign: VerticalAlignTable.TOP }),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cw,
    borders: BORDERS,
    rows: [header, ...rows],
  });
}

/** Tabela genérica com cabeçalho colorido + linhas zebradas. */
function tabelaDados(
  headers: string[], colFracs: number[], linhas: string[][],
  opts: { headerFill?: string; destacaLinha?: (l: string[]) => boolean } = {},
): Table {
  const cw = colFracs.map(f => Math.floor(CONTENT_W * f));
  cw[cw.length - 1] = CONTENT_W - cw.slice(0, -1).reduce((a, b) => a + b, 0);

  const header = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      cell([pCell(h, { bold: true, size: 7.5, align: AlignmentType.CENTER, color: K.branco })],
        { width: cw[i], fill: opts.headerFill ?? K.azul }),
    ),
  });
  const rows = linhas.map((linha, idx) => {
    const destaque = opts.destacaLinha?.(linha);
    const bg = destaque ? K.vermelhoL : (idx % 2 === 0 ? K.branco : K.cinzaL);
    return new TableRow({
      children: linha.map((val, i) =>
        cell([pCell(val, { size: 7.5, align: AlignmentType.CENTER, bold: i === 0 })],
          { width: cw[i], fill: bg }),
      ),
    });
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cw,
    borders: BORDERS,
    rows: [header, ...rows],
  });
}

/** Caixa de identificação azul-clara do vaso (capa e memorial de cálculo). */
function caixaIdentificacao(eq: any, classe: string, grp: string, cat: string): (Paragraph | Table)[] {
  const cw3 = Math.floor(CONTENT_W / 3);
  const cw2 = Math.floor(CONTENT_W / 2);
  const titulo = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: K.azulC, color: 'auto' },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: K.azulM },
      left: { style: BorderStyle.SINGLE, size: 6, color: K.azulM },
      right: { style: BorderStyle.SINGLE, size: 6, color: K.azulM },
    },
    children: [t(`VASO DE PRESSÃO – ${eq.tag}`, { bold: true, size: 10, color: K.azul })],
  });
  const linha1 = new TableRow({
    children: [`Classe ${classe}`, grp, `Categoria ${cat}`].map(txt =>
      cell([pCell(txt, { align: AlignmentType.CENTER })], { width: cw3, fill: K.azulC }),
    ),
  });
  const linha2 = new TableRow({
    children: [
      cell([pCell(`Fluido de Trabalho: ${eq.fluido || '—'}`, { align: AlignmentType.CENTER })],
        { width: cw2, fill: K.azulC }),
      cell([pCell(`Tipo: ${eq.posicao || '—'}`, { align: AlignmentType.CENTER })],
        { width: cw2, fill: K.azulC }),
    ],
  });
  const grade = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [cw3, cw3, cw3],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: K.azulM },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: K.azulM },
      left: { style: BorderStyle.SINGLE, size: 6, color: K.azulM },
      right: { style: BorderStyle.SINGLE, size: 6, color: K.azulM },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: K.azulM },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: K.azulM },
    },
    rows: [linha1, linha2],
  });
  return [titulo, grade];
}

/** Imagem centralizada com largura-alvo, preservando aspect ratio. */
function imagemCentral(buffer: Buffer, w: number, h: number, maxW: number, maxH: number,
                       fmt: 'png' | 'jpg'): Paragraph {
  const escala = Math.min(maxW / w, maxH / h, 1);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new ImageRun({
      data: buffer, type: fmt,
      transformation: { width: Math.round(w * escala), height: Math.round(h * escala) },
    })],
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Função principal
// ═════════════════════════════════════════════════════════════════════════════
export async function gerarDOCXBuffer(input: DocxInput): Promise<Buffer> {
  const { eq, insp, me, pontos, instrumentos, fotosPrep, capaPrep,
          clienteLogoPrep, docsGerados, logoNortendBuffer, derivados } = input;
  const ov: ResultadoOverrides = input.overrides || {};
  const { pmta, vol, pvMpa, cat, grp, classe, dtInsp, phNome, phCrea, art, numRel } = derivados;

  const children: (Paragraph | Table)[] = [];

  // ── CAPA ───────────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 },
    children: [t('RELATÓRIO DE INSPEÇÃO', { bold: true, size: 14, color: K.azul })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [t('DE SEGURANÇA', { bold: true, size: 14, color: K.azul })],
  }));
  if (clienteLogoPrep) {
    children.push(imagemCentral(clienteLogoPrep.buffer, clienteLogoPrep.w, clienteLogoPrep.h,
      200, 110, 'png'));
  }
  if (capaPrep) {
    children.push(imagemCentral(capaPrep.buffer, capaPrep.w, capaPrep.h, 320, 240, 'jpg'));
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 160 },
      children: [new TextRun({ text: capaPrep.legenda, font: FONT, size: 18, italics: true, color: K.cinzaT })],
    }));
  }
  children.push(...caixaIdentificacao(eq, classe, grp, cat));

  // ── INTRODUÇÃO ─────────────────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(paraTexto(
    `Este relatório tem como objetivo apresentar os resultados da Inspeção de Segurança ` +
    `Periódica do Vaso de Pressão ${eq.tag}, ${eq.fabricante || ''}, ` +
    `Nº de Série ${eq.serie || ''}, pertencente à empresa ${eq.cli_nome}, ` +
    `formalizando assim o cumprimento das exigências da Norma Reguladora do Ministério ` +
    `do Trabalho de nº 13 (NR-13).`));
  children.push(paraTexto(
    'Esta Norma estabelece requisitos mínimos para a gestão da integridade estrutural de ' +
    'caldeiras a vapor, vasos de pressão e suas tubulações de interligação nos aspectos ' +
    'relacionados à instalação, inspeção, operação e manutenção, visando à segurança e à ' +
    'saúde dos trabalhadores.'));
  children.push(paraTexto(
    'Fixa os requisitos mínimos para a inspeção de segurança de Caldeiras e vasos de ' +
    'pressão em serviços.'));

  // ── DADOS DO EQUIPAMENTO ───────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(barraSecao('DADOS DO EQUIPAMENTO'));
  children.push(tabelaKV([
    ['Equipamento:', 'VASO DE PRESSÃO'],
    ['TAG:', eq.tag],
    ['Fabricante:', eq.fabricante || '—'],
    ['Modelo:', '—'],
    ['Nº de Série:', eq.serie || '—'],
    ['Ano:', String(eq.ano || '—')],
    ['Código de Projeto:', eq.codigo_projeto || '—'],
    ['Local:', eq.local_instalacao || '—'],
    ['Vertical/Horizontal:', eq.posicao || '—'],
    ['Categoria:', cat],
    ['Capacidade Vol (m³):', fn(eq.volume, 3)],
    ['Pressão Operação:', `${fn(eq.pressao_operacao)} kgf/cm²`],
    ['Temp. de Projeto:', `${fn(eq.temperatura_projeto)} °C`],
    ['PMTA:', `${fn(pmta)} bar`],
    ['Pressão Teste Hidrost.:', `${fn(eq.pressao_hidro)} bar`],
    ['Metal da Base:', eq.metal_base || 'ASME SA-36'],
  ]));

  children.push(barraSecao('LOCALIDADE DA INSTALAÇÃO DO EQUIPAMENTO'));
  const endCli = [eq.logradouro, eq.cli_num, eq.bairro].filter(Boolean).join(', ');
  children.push(tabelaKV([
    ['Empresa:', eq.cli_nome],
    ['CNPJ:', eq.cnpj || '—'],
    ['Endereço:', endCli || '—'],
    ['Cidade / CEP:', `${eq.cidade || '—'} – ${eq.uf || '—'}`],
    ['Telefone:', eq.tel || '—'],
    ['E-mail:', eq.email || '—'],
    ['Responsável:', eq.responsavel || '—'],
    ['Cargo:', eq.cargo || '—'],
  ]));

  // ── EMPRESA INSPETORA + NORMAS ─────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(barraSecao('EMPRESA INSPETORA E/OU PH'));
  children.push(tabelaKV([
    ['Empresa:', 'NORT.END ENGENHARIA E INSPEÇÃO'],
    ['CNPJ:', '36.724.646/0001-69'],
    ['Endereço:', 'Rua dos Japoneses, 10, ap 02'],
    ['Cidade / CEP:', 'Manaus/AM – 69.054-650'],
    ['Telefone:', '(92) 99387-6271'],
    ['E-mail:', 'eng.nortend@gmail.com'],
    ['Profissional Habilitado (PH):', phNome],
    ['CREA:', phCrea],
    ['Cargo:', 'Engenheiro Responsável'],
    ['ART desta Inspeção:', art],
  ]));

  children.push(barraSecao('INSPEÇÕES CONTRATADAS E REALIZADAS'));
  children.push(tabelaDados(
    ['Tipo', 'Descrição'], [0.38, 0.62],
    [
      ['Periódicas NR-13:', insp?.tipo || 'Externa'],
      ['Ensaio não destrutivo:', 'Medição de Espessura por Ultrassom'],
      ['Calibração:', 'Instrumentos de Segurança (Manômetros e Válvulas de Segurança)'],
    ],
    { headerFill: K.cinzaH },
  ));

  children.push(barraSecao('NORMAS DE REFERÊNCIA PARA INSPEÇÕES REALIZADAS'));
  children.push(tabelaDados(
    ['Norma', 'Aplicação'], [0.40, 0.60],
    [
      ['Norma Reg. do MTE:', 'NR-13 – Caldeiras e Vasos de Pressão'],
      ['Petrobras N-1597:', 'Ensaio Não-Destrutivo – Visual'],
      ['Petrobras N-1594:', 'Ensaio Não-Destrutivo – Ultrassom – ME'],
      ['ASME Seção VIII, Div. I:', 'Rules for Construction of Pressure Vessels'],
    ],
    { headerFill: K.cinzaH },
  ));

  // ── DATA + RESULTADO DA INSPEÇÃO ───────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(barraSecao('DATA DA INSPEÇÃO'));
  children.push(tabelaKV([
    ['Início das Inspeções:', fdt(dtInsp)],
    ['Término das Inspeções:', fdt(dtInsp)],
  ]));

  children.push(barraSecao('4 – RESULTADO DA INSPEÇÃO'));

  const inspecaoNoInicio = insp?.tipo === 'Externa' || insp?.tipo === 'Interna';
  const recomendacoesPraticadas = insp?.observacoes?.includes('recomendação') || false;
  children.push(subSecao('4.1 EXAME DOS PRONTUÁRIOS'));
  children.push(tabelaChecklist([
    { n: 1, desc: 'A presente inspeção foi iniciada dentro do prazo para isso fixado na NR-13?',
      sim: resolverSim(ov, 'prontuarios.1', inspecaoNoInicio),
      obs: resolverObs(ov, 'prontuarios.1', '') },
    { n: 2, desc: 'As recomendações anteriores foram devidamente postas em prática?',
      sim: resolverSim(ov, 'prontuarios.2', recomendacoesPraticadas),
      obs: resolverObs(ov, 'prontuarios.2', '') },
  ]));

  const vasoFunciona = insp?.resultado !== 'Inapto';
  const equipSatisfazSeguranca = insp?.resultado === 'Apto' || insp?.resultado === 'Apto com restrições';
  const anomaliaObservada = insp?.resultado === 'Inapto' || insp?.observacoes?.includes('anomalia') || false;
  children.push(subSecao('EXAME EXTERNO DO EQUIPAMENTO'));
  children.push(tabelaChecklist([
    { n: 1, desc: 'O vaso de pressão funciona normalmente?',
      sim: resolverSim(ov, 'externo.1', vasoFunciona),
      obs: resolverObs(ov, 'externo.1', '') },
    { n: 2, desc: 'O vaso de pressão satisfaz a todas as condições de segurança desta Norma NR-13 observáveis neste exame?',
      sim: resolverSim(ov, 'externo.2', equipSatisfazSeguranca),
      obs: resolverObs(ov, 'externo.2', '') },
    { n: 3, desc: 'A parte de caracterização do equipamento (placa de identificação) acessível ao exame confere com o que, sobre elas constam dos prontuários?',
      sim: resolverSim(ov, 'externo.3', true),
      obs: resolverObs(ov, 'externo.3', '') },
    { n: 4, desc: 'Foi observada alguma anomalia capaz de prejudicar a segurança?',
      sim: resolverSim(ov, 'externo.4', anomaliaObservada),
      obs: resolverObs(ov, 'externo.4', '') },
    { n: 5, desc: 'Além do exame normal, foi realizado o exame externo complementar com este parado?',
      sim: resolverSim(ov, 'externo.5', false),
      obs: resolverObs(ov, 'externo.5', '') },
    { n: 6, desc: 'Foram calibrados os manômetros e válvulas de segurança?',
      sim: resolverSim(ov, 'externo.6', true),
      obs: resolverObs(ov, 'externo.6', 'Todos os certificados dos instrumentos estão em anexo.') },
  ]));

  const anomaliaInterna = insp?.observacoes?.includes('anomalia interna') || false;
  children.push(subSecao('4.3 EXAME INTERNO'));
  children.push(tabelaChecklist([
    { n: 1, desc: 'O vaso de pressão antes de ser limpo, apresentava alguma anomalia?',
      sim: resolverSim(ov, 'interno.1', anomaliaInterna),
      obs: resolverObs(ov, 'interno.1', '') },
    { n: 2, desc: 'Internamente, o vaso de pressão depois de limpo, está em ordem e satisfaz todas as condições de segurança constante da NBR 12177 da ABNT?',
      sim: resolverSim(ov, 'interno.2', !anomaliaInterna),
      obs: resolverObs(ov, 'interno.2', '') },
    { n: 3, desc: 'A parte da caracterização do vaso acessível a esse exame confere com o que sobre a mesma consta no prontuário?',
      sim: resolverSim(ov, 'interno.3', true),
      obs: resolverObs(ov, 'interno.3', '') },
    { n: 4, desc: 'Foi observada alguma anomalia capaz de prejudicar a segurança?',
      sim: resolverSim(ov, 'interno.4', anomaliaInterna),
      obs: resolverObs(ov, 'interno.4', '') },
  ]));

  children.push(barraSecao('ATUALIZAÇÃO DA PMTA'));
  children.push(tabelaChecklist([
    { n: 1, desc: `A atual PMTA de ${fn(pmta)} bar pode ser mantida?`,
      sim: resolverSim(ov, 'pmta.1', true),
      obs: resolverObs(ov, 'pmta.1', 'PMTA definida conforme memória de cálculo contida no prontuário do vaso de pressão.') },
  ]));

  const precisoTesteHidro = insp?.tipo === 'Interna' || false;
  children.push(barraSecao('ENSAIO HIDROSTÁTICO'));
  children.push(tabelaChecklist([
    { n: 1, desc: 'Foi realizado ensaio hidrostático?',
      sim: resolverSim(ov, 'hidro.1', precisoTesteHidro),
      obs: resolverObs(ov, 'hidro.1', `O próximo teste hidrostático será realizado em ${fdt(eq.prox_hidro)}.`) },
    { n: 2, desc: 'Foi observada alguma anomalia capaz de prejudicar a segurança?',
      sim: resolverSim(ov, 'hidro.2', false),
      obs: resolverObs(ov, 'hidro.2', '') },
  ]));

  const realizouME = !!me;
  children.push(barraSecao('OUTROS ENSAIOS'));
  children.push(tabelaChecklist([
    { n: 1, desc: 'Foi realizado algum ensaio adicional?',
      sim: resolverSim(ov, 'outros.1', realizouME),
      obs: resolverObs(ov, 'outros.1', realizouME ? 'Realizado ensaio de ME para verificar se houve perda de massa estrutural do vaso.' : '') },
  ]));

  const apto = (insp?.resultado || 'Apto') === 'Apto';
  const aptoComRestricoes = (insp?.resultado || 'Apto') === 'Apto com restrições';
  const tipoInspDocx: TipoInspecaoMarcado = resolverTipoInspecao(ov, 'periodica');
  children.push(barraSecao('CONCLUSÃO'));
  children.push(tabelaChecklist([
    { n: 1, desc: 'O Vaso de Pressão inspecionado pode ser utilizado normalmente?',
      sim: resolverSim(ov, 'conclusao.1', apto || aptoComRestricoes),
      obs: resolverObs(ov, 'conclusao.1', insp?.observacoes || '') },
    { n: 2, desc: 'O Vaso de Pressão deverá ser submetido a nova inspeção de segurança, de acordo com a NR-13 do M.T.E.',
      sim: resolverSim(ov, 'conclusao.2-sim', true),
      obs: resolverObs(ov, 'conclusao.2-sim', obsConclusaoTipo(tipoInspDocx)) },
  ]));

  // ── MEMORIAL DE CÁLCULO ────────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(barraSecao('MEMORIAL DE CÁLCULO'));
  children.push(paraTexto(
    'Segundo a NR-13, os vasos de pressão são classificados em grupos, classe e categoria ' +
    'de potencial de risco em função do produto P.V, onde P é a pressão máxima de operação ' +
    'em MPa e V o seu volume em m³.'));
  children.push(...caixaIdentificacao(eq, classe, grp, cat));
  children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
  children.push(tabelaKV([
    ['PMTA:', `${fn(pmta)} bar`],
    ['Pressão em MPa:', fn(pmta * 0.1)],
    ['Volume em m³:', fn(vol, 3)],
    ['P×V (MPa·m³):', fn(pvMpa, 4)],
    ['Grupo Potencial de Risco:', grp],
    ['Classe do Fluido:', `Classe ${classe}: ${eq.fluido || ''}`],
    ['Categoria do Vaso:', cat],
    ['Enquadramento:', pvMpa > 0 ? 'Se enquadra' : 'Verificar'],
  ]));

  // ── 5.1 PRÓXIMAS INSPEÇÕES ─────────────────────────────────────────────────
  children.push(barraSecao('5.1 – PRÓXIMAS INSPEÇÕES PERIÓDICAS A SEREM REALIZADAS'));
  children.push(paraTexto(
    'Conforme 13.4.4.4(a) a Inspeção Periódica com Exame Externo e Exame Interno, ' +
    'deve ser realizada no máximo em 12 meses.'));
  const recExtDocx = resolverDataRecPH(ov, 'prox.externo.recph');
  const recIntDocx = resolverDataRecPH(ov, 'prox.interno.recph');
  const recHidDocx = resolverDataRecPH(ov, 'prox.hidro.recph');
  children.push(tabelaDados(
    ['Tipo de Inspeção', 'NR-13', 'Recom. PH', 'Data máx.'],
    [0.28, 0.18, 0.18, 0.36],
    [
      ['Exame Externo', '5 anos', recExtDocx ? fdt(recExtDocx) : '1 ano', fdt(insp?.prox_externo || eq.prox_externo || '')],
      ['Exame Interno', '10 anos', recIntDocx ? fdt(recIntDocx) : '5 anos', fdt(insp?.prox_interno || eq.prox_interno || '')],
      ['Teste Hidrostático', '20 anos', recHidDocx ? fdt(recHidDocx) : '10 anos', fdt(eq.prox_hidro || '')],
    ],
  ));

  // ── 5.2 DOCUMENTAÇÃO GERADA ────────────────────────────────────────────────
  children.push(barraSecao('5.2 – DOCUMENTAÇÃO GERADA PELA INSPEÇÃO'));
  for (const linha of docsGerados) {
    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [t(linha, { size: 10 })],
    }));
  }

  // Detalhe dos instrumentos
  if (instrumentos.length > 0) {
    children.push(subSecao('Instrumentos de medição utilizados'));
    children.push(tabelaDados(
      ['Instrumento', 'Nº Série', 'Cert.', 'Calibração', 'Validade'],
      [0.30, 0.18, 0.16, 0.18, 0.18],
      instrumentos.map(im => [
        `${im.nome}${im.modelo ? ' — ' + im.modelo : ''}`,
        im.serie || '—',
        im.certificado_numero || '—',
        fdt(im.data_calibracao),
        fdt(im.validade_calibracao),
      ]),
    ));
  }

  // ── 6 RELATÓRIO FOTOGRÁFICO ────────────────────────────────────────────────
  if (fotosPrep.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(barraSecao('6 – RELATÓRIO FOTOGRÁFICO'));
    // Grade de 2 colunas: cada célula tem foto + legenda.
    const colW = Math.floor(CONTENT_W / 2);
    const linhasFoto: TableRow[] = [];
    for (let i = 0; i < fotosPrep.length; i += 2) {
      const par = [fotosPrep[i], fotosPrep[i + 1]].filter(Boolean);
      linhasFoto.push(new TableRow({
        children: par.map(f => {
          const conteudo: Paragraph[] = [];
          if (f.buffer) {
            conteudo.push(imagemCentral(f.buffer, f.w, f.h, 230, 175, 'jpg'));
          } else {
            conteudo.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [t('[Imagem indisponível]', { size: 8, color: K.cinzaT })],
            }));
          }
          conteudo.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${f.numero} – ${f.legenda}`, font: FONT, size: 16, italics: true, color: K.cinzaT })],
          }));
          return cell(conteudo, { width: colW, valign: VerticalAlignTable.TOP });
        }).concat(par.length === 1 ? [cell([new Paragraph({ children: [] })], { width: colW })] : []),
      }));
    }
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [colW, colW],
      borders: BORDERS,
      rows: linhasFoto,
    }));
  }

  // ── 7 ENSAIO DE ULTRASSOM ──────────────────────────────────────────────────
  if (me) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(barraSecao('ENSAIO NÃO DESTRUTIVO – MEDIÇÃO DE ESPESSURA POR ULTRASSOM'));
    children.push(tabelaKV([
      ['Equipamento de medição:', me.equipamento_med || '—'],
      ['Cabeçote:', me.cabecote || '—'],
      ['Acoplante:', me.acoplante || '—'],
      ['Cert. Calibração:', me.cert_calibracao || '—'],
      ['Data de Calibração:', fdt(me.data_calibracao)],
      ['Validade:', fdt(me.validade_calibracao)],
      ['Metal da Base:', me.metal_base || 'ASME SA-36'],
      ['Cond. Superficial:', me.condicao_superficial || '—'],
      ['Temperatura da Peça:', me.temperatura_peca ? `${me.temperatura_peca} °C` : '—'],
      ['Inspetor:', me.inspetor || '—'],
      ['Norma de Referência:', me.norma || 'Petrobras N-1594 | ASME VIII Div.1'],
      ['Procedimento/Rev:', me.procedimento || 'VEX ME-001 Rev.:00'],
    ]));
    if (pontos.length > 0) {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      children.push(tabelaDados(
        ['PONTO', 'LOCAL / REGIÃO', 'e NOM. (mm)', 'e MED. (mm)', 'e MÍN. (mm)', 'OBSERVAÇÕES / STATUS'],
        [0.08, 0.25, 0.12, 0.12, 0.12, 0.31],
        pontos.map(pt => {
          const enc = parseFloat(pt.espessura_encontrada) || 0;
          const minn = parseFloat(pt.espessura_minima) || 0;
          const ok = enc >= minn;
          return [
            String(pt.numero), pt.regiao || '—', fn(pt.espessura_nominal),
            fn(enc), fn(minn), ok ? 'Conforme' : 'NÃO CONFORME',
          ];
        }),
        {
          headerFill: K.verdeH,
          destacaLinha: (l) => l[5] === 'NÃO CONFORME',
        },
      ));
    }
    if (me.conclusao) {
      children.push(new Paragraph({ spacing: { before: 120 }, children: [] }));
      children.push(paraTexto(`Conclusão: ${me.conclusao}`));
    }
  }

  // ── 8 CONCLUSÃO ────────────────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(barraSecao('8 – CONCLUSÃO'));
  children.push(paraTexto(
    'De acordo com o objetivo desta inspeção, de apresentar os resultados encontrados ' +
    'na mesma, o vaso de pressão descrito nesse relatório encontra-se em boas condições ' +
    'físicas e atende aos requisitos definidos pela Norma NR-13, estando assim apto ' +
    'tecnicamente para ser operado, respeitando as recomendações e condições técnicas ' +
    'de operação, conforme apresentado pelo PH neste relatório.'));
  children.push(paraTexto(
    `As inspeções periódicas previstas na NR-13 devem ser rigorosamente seguidas nesse ` +
    `período. O Equipamento deverá operar com a pressão Máxima de Trabalho Admissível ` +
    `de ${fn(pmta)} bar.`));

  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 280 },
    children: [t(`Manaus-AM, ${fdt(dtInsp)}`, { size: 10 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 240 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA', space: 2 } },
    children: [t(phNome, { bold: true, size: 10 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [t('Eng. Responsável', { size: 10 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [t(`CREA – ${phCrea}`, { size: 10 })],
  }));

  // ── Header / Footer (faixa azul + rodapé institucional) ────────────────────
  const headerLogo = logoNortendBuffer
    ? new Paragraph({
        children: [new ImageRun({
          data: logoNortendBuffer, type: 'png',
          transformation: { width: 120, height: 34 },
        })],
      })
    : new Paragraph({ children: [t('NORT.END', { bold: true, size: 9, color: K.azul })] });

  const header = new Header({
    children: [
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [Math.floor(CONTENT_W * 0.30), Math.floor(CONTENT_W * 0.48),
                       Math.floor(CONTENT_W * 0.22)],
        borders: {
          top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
        },
        rows: [new TableRow({
          children: [
            cell([headerLogo], { width: Math.floor(CONTENT_W * 0.30), fill: K.azul }),
            cell([new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [t('RELATÓRIO DE INSPEÇÃO DE SEGURANÇA', { bold: true, size: 8, color: K.branco })],
            })], { width: Math.floor(CONTENT_W * 0.48), fill: K.azul }),
            cell([
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [t(`Relatório: ${numRel}`, { size: 8, color: K.branco })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  t('Página ', { size: 8, color: K.branco }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: K.branco }),
                ],
              }),
            ], { width: Math.floor(CONTENT_W * 0.22), fill: K.azul }),
          ],
        })],
      }),
    ],
  });

  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 8, color: K.laranja, space: 2 } },
      children: [t(
        'Nort.End - Engenharia e Inspeção | 92 99387.6271 | www.nortendengenharia.com.br | ' +
        'eng.nortend@gmail.com | CNPJ: 36.724.646/0001-69',
        { size: 7, color: K.cinzaT })],
    })],
  });

  // ── Documento ──────────────────────────────────────────────────────────────
  const doc = new Document({
    creator: 'NORT.END Engenharia e Inspeção',
    title: `Relatório de Inspeção NR-13 – ${eq.tag}`,
    styles: {
      default: { document: { run: { font: FONT, size: 18 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: 1700, bottom: 1100, left: MARGIN, right: MARGIN },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
