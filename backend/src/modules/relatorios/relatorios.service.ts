import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import * as path from 'path';
import * as fs from 'fs';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import sharp from 'sharp';

type FotoPrep = {
  buffer: Buffer | null;
  w: number;
  h: number;
  legenda: string;
  numero: number;
};

// ─── Cores da marca NORT.END ──────────────────────────────────────────────────
const C = {
  azul:    '#0A2F3F',
  azulM:   '#114B66',
  azulC:   '#D7E7EF',
  laranja: '#E07000',
  cinzaH:  '#D9D9D9',
  cinzaL:  '#F4F4F4',
  verdeH:  '#375623',
  branco:  '#FFFFFF',
  preto:   '#000000',
  cinzaT:  '#595959',
};

// ─── Layout A4 (pontos) ───────────────────────────────────────────────────────
const ML   = 42.52;                    // padding/margem = 15 mm
const MT   = ML;
const MB   = ML;
const PGW  = 595.28;
const PGH  = 841.89;
const TW   = PGW - 2 * ML;            // largura útil    = 180 mm
const HDRH = 39.69;                    // altura do header = 14 mm
const HDRY = MT;                       // topo do header alinhado ao padding superior
const FTRY = PGH - MB;                 // referência do rodapé alinhada ao padding inferior
const CONTENT_TOP    = HDRY + HDRH + 12;     // respiro após header
const CONTENT_BOTTOM = FTRY - 30;            // respiro antes do rodapé

const LOGO = path.join(process.cwd(), 'assets', 'logo_nortend.png');

// ─── Formatação ───────────────────────────────────────────────────────────────
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

// ─── Service ──────────────────────────────────────────────────────────────────
@Injectable()
export class RelatoriosService {
  constructor(private readonly db: DatabaseService) {}

  async gerarPDF(equipamentoId: string, inspecaoId?: string): Promise<Buffer> {
    // ── 1. Carregar dados do banco (better-sqlite3 é síncrono) ───────────────
    const db = this.db.instance;

    const eq = db.prepare(`
      SELECT e.*,
             c.nome    AS cli_nome,  c.cnpj,        c.tel,   c.email,
             c.logradouro,           c.numero        AS cli_num,
             c.bairro,               c.cidade,       c.uf,
             c.responsavel,          c.cargo
      FROM equipamentos e
      JOIN clientes c ON e.cliente_id = c.id
      WHERE e.id = ?
    `).get(equipamentoId) as any;

    if (!eq) throw new NotFoundException('Equipamento não encontrado');

    const insp = inspecaoId
      ? db.prepare(`
          SELECT * FROM inspecoes
          WHERE id = ? AND equipamento_id = ?
        `).get(inspecaoId, equipamentoId) as any
      : db.prepare(`
          SELECT * FROM inspecoes
          WHERE equipamento_id = ?
          ORDER BY data DESC LIMIT 1
        `).get(equipamentoId) as any;
    if (inspecaoId && !insp) throw new NotFoundException('Inspeção não encontrada para este equipamento');

    const me = inspecaoId
      ? db.prepare(`
          SELECT * FROM medicoes_espessura
          WHERE inspecao_id = ?
          ORDER BY criado_em DESC LIMIT 1
        `).get(inspecaoId) as any
      : db.prepare(`
          SELECT * FROM medicoes_espessura
          WHERE equipamento_id = ?
          ORDER BY criado_em DESC LIMIT 1
        `).get(equipamentoId) as any;

    const pontos: any[] = me
      ? db.prepare(`SELECT * FROM pontos_me WHERE medicao_id = ? ORDER BY ordem`).all(me.id)
      : [];

    const fotos: any[] = inspecaoId
      ? db.prepare(`
          SELECT * FROM fotos WHERE inspecao_id = ? ORDER BY numero
        `).all(inspecaoId)
      : db.prepare(`
          SELECT * FROM fotos WHERE equipamento_id = ? ORDER BY numero
        `).all(equipamentoId);

    // Foto de capa (se marcada)
    const fotoCapa: any = eq.foto_capa_id
      ? db.prepare(`SELECT * FROM fotos WHERE id = ?`).get(eq.foto_capa_id)
      : null;

    // Instrumentos de medição vinculados à última inspeção
    const instrumentos: any[] = insp
      ? db.prepare(`
          SELECT im.*
          FROM inspecao_instrumentos ii
          JOIN instrumentos_medicao im ON im.id = ii.instrumento_id
          WHERE ii.inspecao_id = ?
          ORDER BY im.nome
        `).all(insp.id)
      : [];

    // ── 2. Derivados ─────────────────────────────────────────────────────────
    const pmta   = parseFloat(eq.pmta)   || 0;
    const vol    = parseFloat(eq.volume) || 0;
    const pvMpa  = pmta * 0.1 * vol;
    const cat    = eq.categoria    || 'V';
    const grp    = eq.grupo_risco  || 'Grupo 5';
    const classe = eq.classe_fluido || 'C';
    // Se não houver inspeção, usar data atual como fallback
    const dtInsp = insp?.data || new Date().toISOString().split('T')[0];
    const phNome = insp?.ph_nome  || 'Igor Cardozo e Oliveira Santos';
    const phCrea = insp?.ph_crea  || '041725365-6';
    const art    = insp?.art      || '—';
    const numRel = `001/${new Date().getFullYear()}`;

    // ── 2.1 Pré-processamento das fotos ──────────────────────────────────────
    // Normaliza orientação EXIF e captura dimensões reais. PDFKit ignora a tag
    // Orientation do JPEG; passar o buffer já rotacionado pelo sharp garante
    // que fotos de celular não saiam deitadas. As dimensões alimentam o
    // algoritmo de layout 2-coluna que preserva aspect ratio.
    const fotosPrep: FotoPrep[] = await Promise.all(fotos.map(async (f: any) => {
      const fp = path.join(process.cwd(), 'uploads', f.filename);
      const legenda = f.legenda || `${f.numero} – ${eq.tag}`;
      if (!fs.existsSync(fp)) {
        return { buffer: null, w: 4, h: 3, legenda, numero: f.numero };
      }
      try {
        const buffer = await sharp(fp).rotate().toBuffer();
        const meta = await sharp(buffer).metadata();
        return {
          buffer,
          w: meta.width  || 4,
          h: meta.height || 3,
          legenda,
          numero: f.numero,
        };
      } catch {
        return { buffer: null, w: 4, h: 3, legenda, numero: f.numero };
      }
    }));

    // ── 3. Montar PDF ─────────────────────────────────────────────────────────
    const baseBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        // ⚠️  ATENÇÃO: margins.bottom DEVE permanecer 0. Não usar MB aqui.
        // O texto do rodapé é desenhado em y ≈ FTRY-18 ≈ 781pt e ocupa ~24pt.
        // Se margins.bottom > 0, PDFKit define maxY = PGH - bottom (≈ 799pt),
        // o drawHF estoura esse limite ao escrever o rodapé, e a auto-page-break
        // dispara duplicando cada página (par de páginas: conteúdo + vazia só com HF).
        // O posicionamento visual do rodapé já é controlado por FTRY/MB; a margem
        // do PDFKit serve só para o algoritmo de quebra de página dele. Bug
        // documentado no CLAUDE.md, seção "PDF report generation — the dangerous file".
        margins: { top: MT, bottom: 0, left: ML, right: ML },
        autoFirstPage: false,
        info: {
          Title:  `Relatório de Inspeção NR-13 – ${eq.tag}`,
          Author: 'NORT.END Engenharia e Inspeção',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data',  c => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let pageNum = 0;
      let drawingHF = false;

      // ── Cursor Y ─────────────────────────────────────────────────────────
      // Mantemos y manualmente para controlar posição com precisão.
      let y = CONTENT_TOP;

      // ── Helpers ──────────────────────────────────────────────────────────
      const sp = (mm = 3) => { y += mm * 2.835; };

      // Toda página criada (manual ou auto-break) recebe header+footer aqui.
      // O guard `drawingHF` evita recursão se o drawHF emitir outro pageAdded.
      doc.on('pageAdded', () => {
        if (drawingHF) return;
        pageNum++;
        drawHF(pageNum);
      });

      const novaPage = () => {
        doc.addPage(); // emite 'pageAdded' → drawHF é desenhado
        y = CONTENT_TOP;
        doc.x = ML;
        doc.y = CONTENT_TOP;
      };

      const checar = (needed = 50) => {
        if (y + needed > CONTENT_BOTTOM) novaPage();
      };

      // ── Header / Footer ───────────────────────────────────────────────────
      const drawHF = (pg: number) => {
        drawingHF = true;
        doc.save();

        // Fundo azul escuro do header
        doc.rect(ML, HDRY, TW, HDRH).fill(C.azul);

        // Proporções das colunas: logo 30% | título 48% | rel 11% | pág 11%
        const cL = TW * 0.30, cT = TW * 0.48, cR = TW * 0.11, cP = TW * 0.11;
        const xL = ML, xT = xL + cL, xR = xT + cT, xPg = xR + cR;
        const midY = HDRY + HDRH / 2;

        // Divisórias brancas
        doc.strokeColor(C.branco).lineWidth(0.5);
        for (const x of [xT, xR, xPg]) {
          doc.moveTo(x, HDRY + 4).lineTo(x, HDRY + HDRH - 4).stroke();
        }

        // Logo
        if (fs.existsSync(LOGO)) {
          doc.image(LOGO, xL + 3, HDRY + 3, {
            width: cL - 6, height: HDRH - 6, fit: [cL - 6, HDRH - 6],
          });
        } else {
          doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(8)
             .text('NORT.END', xL + 4, midY - 6, { lineBreak: false });
        }

        // Título
        doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(8)
           .text('RELATÓRIO DE INSPEÇÃO DE SEGURANÇA',
                 xT, midY - 6, { width: cT, align: 'center', lineBreak: false });

        // Coluna relatório
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.azulC)
           .text('Relatório:', xR, midY - 12, { width: cR, align: 'center', lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor(C.branco)
           .text(numRel, xR, midY + 2, { width: cR, align: 'center', lineBreak: false });

        // Coluna página
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.azulC)
           .text('Página', xPg, midY - 12, { width: cP, align: 'center', lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor(C.branco)
           .text(String(pg), xPg, midY + 2, { width: cP, align: 'center', lineBreak: false });

        // Linha laranja do rodapé
        doc.strokeColor(C.laranja).lineWidth(0.8)
           .moveTo(ML, FTRY - 6).lineTo(ML + TW, FTRY - 6).stroke();

        // Texto do rodapé
        doc.fillColor(C.cinzaT).font('Helvetica').fontSize(8)
           .text(
             'NORT.END - ENGENHARIA E INSPEÇÃO  |  92 99387.6271  |  ENG.NORTEND@GMAIL.COM\n' +
             'CNPJ: 36.724.646/0001-69  |  CREA-AM: 041725365-6',
             ML, FTRY - 18, { width: TW, align: 'center' },
           );

        doc.restore();
        // Devolve cursor para o início do conteúdo, caso PDFKit use doc.y depois
        doc.x = ML;
        doc.y = CONTENT_TOP;
        drawingHF = false;
      };

      // ── Barra de seção ────────────────────────────────────────────────────
      const secao = (txt: string) => {
        checar(30);
        const bh = 26;
        doc.save()
           .rect(ML, y, TW, bh).fill(C.azul)
           .strokeColor(C.laranja).lineWidth(1.5)
           .moveTo(ML, y + bh).lineTo(ML + TW, y + bh).stroke()
           .restore();
        doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(10)
           .text(txt.toUpperCase(), ML + 6, y + 8,
                 { width: TW - 12, lineBreak: false });
        y += bh + 4;
      };

      // ── Tabela label | valor (2 colunas por linha, 4 colunas totais) ──────
      const kvRow = (pairs: [string, string][], rh = 24) => {
        const cw = TW / 4;
        pairs.forEach((_, i) => {
          if (i % 2 !== 0) return;
          checar(rh);
          const ry = y;
          doc.save()
             .rect(ML,          ry, cw, rh).fill(C.cinzaH)
             .rect(ML + 2 * cw, ry, cw, rh).fill(C.cinzaH)
             .restore();
          doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
             .rect(ML, ry, TW, rh).stroke().restore();
          doc.fillColor(C.preto).font('Helvetica-Bold').fontSize(10)
             .text(pairs[i][0], ML + 4, ry + 7,
                   { width: cw - 8, lineBreak: false });
          doc.font('Helvetica')
             .text(pairs[i][1] || '—', ML + cw + 4, ry + 7,
                   { width: cw - 8, lineBreak: false });
          if (pairs[i + 1]) {
            doc.font('Helvetica-Bold')
               .text(pairs[i + 1][0], ML + 2 * cw + 4, ry + 7,
                     { width: cw - 8, lineBreak: false });
            doc.font('Helvetica')
               .text(pairs[i + 1][1] || '—', ML + 3 * cw + 4, ry + 7,
                     { width: cw - 8, lineBreak: false });
          }
          y += rh;
        });
      };

      // ── Checklist header ──────────────────────────────────────────────────
      const CWS = [TW*0.06, TW*0.52, TW*0.14, TW*0.28];
      const HDRS = ['Nº', 'Descrição', 'Resultado', 'Observações'];

      const chkHdr = () => {
        checar(22);
        const rh = 26;
        doc.save().rect(ML, y, TW, rh).fill(C.azul).restore();
        let cx = ML;
        HDRS.forEach((h, i) => {
          doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(10)
             .text(h, cx + 3, y + 8,
                   { width: CWS[i] - 6, align: 'center', lineBreak: false });
          cx += CWS[i];
        });
        y += rh;
      };

      const chkItem = (n: number, desc: string, sim: boolean, obs = '') => {
        checar(28);
        const rh = 38;
        const bg = n % 2 === 0 ? C.cinzaL : C.branco;
        doc.save().rect(ML, y, TW, rh).fill(bg)
           .strokeColor('#CCCCCC').lineWidth(0.3).rect(ML, y, TW, rh).stroke().restore();

        let cx = ML;
        // Nº
        doc.fillColor(C.preto).font('Helvetica').fontSize(10)
           .text(String(n), cx + 2, y + 14,
                 { width: CWS[0] - 4, align: 'center', lineBreak: false });
        cx += CWS[0];
        // Descrição
        doc.text(desc, cx + 3, y + 6, { width: CWS[1] - 6 });
        cx += CWS[1];
        // Resultado
        doc.fontSize(10)
           .text(sim ? '(x) Sim\n( ) Não' : '( ) Sim\n(x) Não',
                 cx + 2, y + 6, { width: CWS[2] - 4, align: 'center' });
        cx += CWS[2];
        // Observações
        doc.fontSize(10)
           .text(obs || '', cx + 3, y + 6, { width: CWS[3] - 6 });
        y += rh;
      };

      // ── Sub-título de bloco (menor que secao) ─────────────────────────────
      const subSecao = (txt: string) => {
        checar(22);
        doc.fillColor(C.azulM).font('Helvetica-Bold').fontSize(10)
           .text(txt, ML, y);
        y = doc.y + 4;
      };

      // ── Texto justificado simples ─────────────────────────────────────────
      // Usa heightOfString para medir a altura real do parágrafo após wrap em
      // 10pt e só então decidir a quebra de página, evitando que o texto invada
      // a faixa do rodapé (CONTENT_BOTTOM = FTRY - 19.85).
      const texto = (txt: string, extraSp = 6) => {
        doc.font('Helvetica').fontSize(10);
        const h = doc.heightOfString(txt, { width: TW, align: 'justify' });
        checar(h + extraSp);
        doc.fillColor(C.preto)
           .text(txt, ML, y, { align: 'justify', width: TW });
        y = doc.y + extraSp;
      };

      // ══════════════════════════════════════════════════════════════════════
      // CAPA
      // ══════════════════════════════════════════════════════════════════════
      novaPage();
      sp(10);

      doc.fillColor(C.azul).font('Helvetica-Bold').fontSize(10)
         .text('RELATÓRIO DE INSPEÇÃO', ML, y, { align: 'center', width: TW });
      y = doc.y + 6;
      doc.text('DE SEGURANÇA', ML, y, { align: 'center', width: TW });
      y = doc.y + 20;

      // Caixa de identificação
      const idH = 78;
      doc.save().rect(ML, y, TW, idH).fill(C.azulC)
         .strokeColor(C.azulM).lineWidth(0.8).rect(ML, y, TW, idH).stroke().restore();
      doc.fillColor(C.azul).font('Helvetica-Bold').fontSize(10)
         .text(`VASO DE PRESSÃO – ${eq.tag}`, ML, y + 8,
               { align: 'center', width: TW, lineBreak: false });

      const sub1Y = y + 32;
      const cw3   = TW / 3;
      [`Classe ${classe}`, grp, `Categoria ${cat}`].forEach((t, i) => {
        doc.save().strokeColor(C.azulM).lineWidth(0.4)
           .rect(ML + i * cw3, sub1Y, cw3, 20).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica').fontSize(10)
           .text(t, ML + i * cw3 + 4, sub1Y + 5,
                 { width: cw3 - 8, align: 'center', lineBreak: false });
      });

      const sub2Y = sub1Y + 20;
      [`Fluido de Trabalho: ${eq.fluido || '—'}`, `Tipo: ${eq.posicao || '—'}`].forEach((t, i) => {
        doc.save().strokeColor(C.azulM).lineWidth(0.4)
           .rect(ML + i * (TW / 2), sub2Y, TW / 2, 20).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica').fontSize(10)
           .text(t, ML + i * (TW / 2) + 4, sub2Y + 5,
                 { width: TW / 2 - 8, align: 'center', lineBreak: false });
      });
      y += idH + 12;

      // Foto de capa do equipamento (se marcada pelo engenheiro)
      if (fotoCapa?.filename) {
        const capaPath = path.join(process.cwd(), 'uploads', fotoCapa.filename);
        if (fs.existsSync(capaPath)) {
          try {
            const imgW = 320;
            const imgH = 240;
            const imgX = ML + (TW - imgW) / 2;
            doc.image(capaPath, imgX, y, { fit: [imgW, imgH], align: 'center' });
            y += imgH + 6;
            if (fotoCapa.legenda) {
              doc.fillColor(C.cinzaT).font('Helvetica-Oblique').fontSize(10)
                 .text(fotoCapa.legenda, ML, y, { width: TW, align: 'center' });
              y = doc.y + 4;
            }
          } catch {
            // Imagem inválida, ignora.
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // PÁG 2 – INTRODUÇÃO
      // ══════════════════════════════════════════════════════════════════════
      novaPage(); sp(4);
      texto(
        `Este relatório tem como objetivo apresentar os resultados da Inspeção de Segurança ` +
        `Periódica do Vaso de Pressão ${eq.tag}, ${eq.fabricante || ''}, ` +
        `Nº de Série ${eq.serie || ''}, pertencente à empresa ${eq.cli_nome}, ` +
        `formalizando assim o cumprimento das exigências da Norma Reguladora do Ministério ` +
        `do Trabalho de nº 13 (NR-13).`
      );
      texto(
        'Esta Norma estabelece requisitos mínimos para a gestão da integridade estrutural de ' +
        'caldeiras a vapor, vasos de pressão e suas tubulações de interligação nos aspectos ' +
        'relacionados à instalação, inspeção, operação e manutenção, visando à segurança e à ' +
        'saúde dos trabalhadores.'
      );
      texto(
        'Fixa os requisitos mínimos para a inspeção de segurança de Caldeiras e vasos de ' +
        'pressão em serviços.'
      );

      // ══════════════════════════════════════════════════════════════════════
      // PÁG 3 – DADOS DO EQUIPAMENTO
      // ══════════════════════════════════════════════════════════════════════
      novaPage();
      secao('DADOS DO EQUIPAMENTO');
      kvRow([
        ['Equipamento:',            'VASO DE PRESSÃO'],
        ['TAG:',                    eq.tag],
        ['Fabricante:',             eq.fabricante || '—'],
        ['Modelo:',                 '—'],
        ['Nº de Série:',            eq.serie || '—'],
        ['Ano:',                    String(eq.ano || '—')],
        ['Código de Projeto:',      eq.codigo_projeto || '—'],
        ['Local:',                  eq.local_instalacao || '—'],
        ['Vertical/Horizontal:',    eq.posicao || '—'],
        ['Categoria:',              cat],
        ['Capacidade Vol (m³):',    fn(eq.volume, 3)],
        ['Pressão Operação:',       `${fn(eq.pressao_operacao)} kgf/cm²`],
        ['Temp. de Projeto:',       `${fn(eq.temperatura_projeto)} °C`],
        ['PMTA:',                   `${fn(pmta)} bar`],
        ['Pressão Teste Hidrost.:', `${fn(eq.pressao_hidro)} bar`],
        ['Metal da Base:',          eq.metal_base || 'ASME SA-36'],
      ]);
      sp(3);

      secao('LOCALIDADE DA INSTALAÇÃO DO EQUIPAMENTO');
      const endCli = [eq.logradouro, eq.cli_num, eq.bairro].filter(Boolean).join(', ');
      kvRow([
        ['Empresa:',     eq.cli_nome],
        ['CNPJ:',        eq.cnpj    || '—'],
        ['Endereço:',    endCli     || '—'],
        ['Cidade / CEP:', `${eq.cidade || '—'} – ${eq.uf || '—'}`],
        ['Telefone:',    eq.tel         || '—'],
        ['E-mail:',      eq.email       || '—'],
        ['Responsável:', eq.responsavel || '—'],
        ['Cargo:',       eq.cargo       || '—'],
      ]);

      // ══════════════════════════════════════════════════════════════════════
      // PÁG 4 – EMPRESA INSPETORA + NORMAS
      // ══════════════════════════════════════════════════════════════════════
      novaPage();
      secao('EMPRESA INSPETORA E/OU PH');
      kvRow([
        ['Empresa:',                    'NORT.END ENGENHARIA E INSPEÇÃO'],
        ['CNPJ:',                       '36.724.646/0001-69'],
        ['Endereço:',                   'Rua dos Japoneses, 10, ap 02'],
        ['Cidade / CEP:',               'Manaus/AM – 69.054-650'],
        ['Telefone:',                   '(92) 99387-6271'],
        ['E-mail:',                     'eng.nortend@gmail.com'],
        ['Profissional Habilitado (PH):', phNome],
        ['CREA:',                       phCrea],
        ['Cargo:',                      'Engenheiro Responsável'],
        ['ART desta Inspeção:',         art],
      ]);
      sp(3);

      secao('INSPEÇÕES CONTRATADAS E REALIZADAS');
      const inspcW1 = TW * 0.38, inspcW2 = TW * 0.62;
      const inspcRows: [string, string][] = [
        ['Periódicas NR-13:',    insp?.tipo || 'Externa'],
        ['Ensaio não destrutivo:', 'Medição de Espessura por Ultrassom'],
        ['Calibração:', 'Instrumentos de Segurança (Manômetros e Válvulas de Segurança)'],
      ];
      inspcRows.forEach(([l, v]) => {
        checar(18);
        const rh = 18;
        doc.save().rect(ML, y, inspcW1, rh).fill(C.cinzaH).restore();
        doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
           .rect(ML, y, TW, rh).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica-Bold').fontSize(7.5)
           .text(l, ML + 4, y + 5, { width: inspcW1 - 8, lineBreak: false });
        doc.font('Helvetica')
           .text(v, ML + inspcW1 + 4, y + 5, { width: inspcW2 - 8, lineBreak: false });
        y += rh;
      });
      sp(3);

      secao('NORMAS DE REFERÊNCIA PARA INSPEÇÕES REALIZADAS');
      const normas: [string, string][] = [
        ['Norma Reg. do MTE:',       'NR-13 – Caldeiras e Vasos de Pressão'],
        ['Petrobras N-1597:',        'Ensaio Não-Destrutivo – Visual'],
        ['Petrobras N-1594:',        'Ensaio Não-Destrutivo – Ultrassom – ME'],
        ['ASME Seção VIII, Div. I:', 'Rules for Construction of Pressure Vessels'],
      ];
      normas.forEach(([l, v]) => {
        checar(18);
        const rh = 18;
        doc.save().rect(ML, y, TW * 0.40, rh).fill(C.cinzaH).restore();
        doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
           .rect(ML, y, TW, rh).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica-Bold').fontSize(7.5)
           .text(l, ML + 4, y + 5, { width: TW * 0.40 - 8, lineBreak: false });
        doc.font('Helvetica')
           .text(v, ML + TW * 0.40 + 4, y + 5,
                 { width: TW * 0.60 - 8, lineBreak: false });
        y += rh;
      });

      // ══════════════════════════════════════════════════════════════════════
      // PÁG 5 – DATA + RESULTADO DA INSPEÇÃO
      // ══════════════════════════════════════════════════════════════════════
      novaPage();
      secao('DATA DA INSPEÇÃO');
      kvRow([
        ['Início das Inspeções:',  fdt(dtInsp)],
        ['Término das Inspeções:', fdt(dtInsp)],
      ]);
      sp(3);

      secao('4 – RESULTADO DA INSPEÇÃO');
      sp(2);

      subSecao('4.1 EXAME DOS PRONTUÁRIOS');
      chkHdr();
      // Usar dados da inspeção se disponível, caso contrário usar defaults
      const inspecaoNoInicio = insp?.tipo === 'Externa' || insp?.tipo === 'Interna';
      const recomendacoesPraticadas = insp?.observacoes?.includes('recomendação') || false;
      chkItem(1, 'A presente inspeção foi iniciada dentro do prazo para isso fixado na NR-13?', inspecaoNoInicio, '');
      chkItem(2, 'As recomendações anteriores foram devidamente postas em prática?', recomendacoesPraticadas, '');
      sp(3);

      subSecao('EXAME EXTERNO DO EQUIPAMENTO');
      chkHdr();
      // Valores baseados em resultado da inspeção
      const vasoFunciona = insp?.resultado !== 'Inapto';
      const equipSatisfazSeguranca = insp?.resultado === 'Apto' || insp?.resultado === 'Apto com restrições';
      const caracDisponivelConfere = true; // Assumir que sim por padrão
      const anomaliaObservada = insp?.resultado === 'Inapto' || insp?.observacoes?.includes('anomalia');
      chkItem(1, 'O vaso de pressão funciona normalmente?', vasoFunciona, '');
      chkItem(2, 'O vaso de pressão satisfaz a todas as condições de segurança desta Norma NR-13 observáveis neste exame?', equipSatisfazSeguranca, '');
      chkItem(3, 'A parte de caracterização do equipamento (placa de identificação) acessível ao exame confere com o que, sobre elas constam dos prontuários?', caracDisponivelConfere, '');
      chkItem(4, 'Foi observada alguma anomalia capaz de prejudicar a segurança?', anomaliaObservada, '');
      chkItem(5, 'Além do exame normal, foi realizado o exame externo complementar com este parado?', false, '');
      chkItem(6, 'Foram calibrados os manômetros e válvulas de segurança?', true, 'Todos os certificados dos instrumentos estão em anexo.');
      sp(3);

      // ══════════════════════════════════════════════════════════════════════
      // PÁG 6 – EXAME INTERNO + PMTA + HIDROSTÁTICO + CONCLUSÃO
      // ══════════════════════════════════════════════════════════════════════
      checar(220);
      subSecao('4.3 EXAME INTERNO');
      chkHdr();
      const anomaliaInterna = insp?.observacoes?.includes('anomalia interna') || false;
      chkItem(1, 'O vaso de pressão antes de ser limpo, apresentava alguma anomalia?', anomaliaInterna, '');
      chkItem(2, 'Internamente, o vaso de pressão depois de limpo, está em ordem e satisfaz todas as condições de segurança constante da NBR 12177 da ABNT?', !anomaliaInterna, '');
      chkItem(3, 'A parte da caracterização do vaso acessível a esse exame confere com o que sobre a mesma consta no prontuário?', true, '');
      chkItem(4, 'Foi observada alguma anomalia capaz de prejudicar a segurança?', anomaliaInterna, '');
      sp(3);

      secao('ATUALIZAÇÃO DA PMTA');
      chkHdr();
      chkItem(1, `A atual PMTA de ${fn(pmta)} bar pode ser mantida?`, true,
        'PMTA definida conforme memória de cálculo contida no prontuário do vaso de pressão.');
      sp(3);

      checar(120);
      secao('ENSAIO HIDROSTÁTICO');
      chkHdr();
      const precisoTesteHidro = insp?.tipo === 'Interna' || false;
      const anomaliaTesteHidro = false;
      chkItem(1, 'Foi realizado ensaio hidrostático?', precisoTesteHidro,
        `O próximo teste hidrostático será realizado em ${fdt(eq.prox_hidro)}.`);
      chkItem(2, 'Foi observada alguma anomalia capaz de prejudicar a segurança?', anomaliaTesteHidro, '');
      sp(3);

      secao('OUTROS ENSAIOS');
      chkHdr();
      const realizouME = me ? true : false;
      chkItem(1, 'Foi realizado algum ensaio adicional?', realizouME,
        realizouME ? 'Realizado ensaio de ME para verificar se houve perda de massa estrutural do vaso.' : '');
      sp(3);

      secao('CONCLUSÃO');
      chkHdr();
      const apto = (insp?.resultado || 'Apto') === 'Apto';
      const apoComRestricoes = (insp?.resultado || 'Apto') === 'Apto com restrições';
      chkItem(1, 'O Vaso de Pressão inspecionado pode ser utilizado normalmente?', apto || apoComRestricoes, insp?.observacoes || '');
      chkItem(2, 'O Vaso de Pressão deverá ser submetido a nova inspeção de segurança, de acordo com a NR-13 do M.T.E.', true, 
        `(${insp?.tipo === 'Interna' ? 'x' : ' '}) Periódica ${insp?.tipo === 'Interna' ? '' : ''}`);

      // ══════════════════════════════════════════════════════════════════════
      // PÁG 7 – MEMORIAL DE CÁLCULO
      // ══════════════════════════════════════════════════════════════════════
      novaPage();
      secao('MEMORIAL DE CÁLCULO');
      sp(2);
      texto(
        'Segundo a NR-13, os vasos de pressão são classificados em grupos, classe e categoria ' +
        'de potencial de risco em função do produto P.V, onde P é a pressão máxima de operação ' +
        'em MPa e V o seu volume em m³.'
      );

      // Caixa de classificação
      const cbH = 76;
      doc.save().rect(ML, y, TW, cbH).fill(C.azulC)
         .strokeColor(C.azulM).lineWidth(0.8).rect(ML, y, TW, cbH).stroke().restore();
      doc.fillColor(C.azul).font('Helvetica-Bold').fontSize(10)
         .text(`VASO DE PRESSÃO – ${eq.tag}`, ML, y + 8, { align: 'center', width: TW });

      const cbs1Y = y + 30;
      [`Classe ${classe}`, grp, `Categoria ${cat}`].forEach((t, i) => {
        doc.save().strokeColor(C.azulM).lineWidth(0.4)
           .rect(ML + i * cw3, cbs1Y, cw3, 20).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica').fontSize(10)
           .text(t, ML + i * cw3 + 4, cbs1Y + 5,
                 { width: cw3 - 8, align: 'center', lineBreak: false });
      });
      [`Fluido de Trabalho: ${eq.fluido || '—'}`, `Tipo: ${eq.posicao || '—'}`].forEach((t, i) => {
        doc.save().strokeColor(C.azulM).lineWidth(0.4)
           .rect(ML + i * (TW / 2), cbs1Y + 20, TW / 2, 20).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica').fontSize(10)
           .text(t, ML + i * (TW / 2) + 4, cbs1Y + 26,
                 { width: TW / 2 - 8, align: 'center', lineBreak: false });
      });
      y += cbH + 10;

      kvRow([
        ['PMTA:',                   `${fn(pmta)} bar`],
        ['Pressão em MPa:',         fn(pmta * 0.1)],
        ['Volume em m³:',           fn(vol, 3)],
        ['P×V (MPa·m³):',           fn(pvMpa, 4)],
        ['Grupo Potencial de Risco:', grp],
        ['Classe do Fluido:',       `Classe ${classe}: ${eq.fluido || ''}`],
        ['Categoria do Vaso:',      cat],
        ['Enquadramento:',          pvMpa > 0 ? 'Se enquadra' : 'Verificar'],
      ]);

      // ══════════════════════════════════════════════════════════════════════
      // PÁG 8 – PRÓXIMAS INSPEÇÕES + DOCUMENTAÇÃO
      // ══════════════════════════════════════════════════════════════════════
      checar(200);
      secao('5.1 – PRÓXIMAS INSPEÇÕES PERIÓDICAS A SEREM REALIZADAS');
      texto('Conforme 13.4.4.4(a) a Inspeção Periódica com Exame Externo e Exame Interno, ' +
            'deve ser realizada no máximo em 12 meses.', 4);

      // Tabela de prazos
      const prxCws = [TW * 0.28, TW * 0.18, TW * 0.18, TW * 0.36];
      const prxHdrs = ['Tipo de Inspeção', 'NR-13', 'Recom. PH', 'Data máx.'];
      const rh18 = 20;

      checar(rh18);
      doc.save().rect(ML, y, TW, rh18).fill(C.azul).restore();
      let pcx = ML;
      prxHdrs.forEach((h, i) => {
        doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(7.5)
           .text(h, pcx + 3, y + 6,
                 { width: prxCws[i] - 6, align: 'center', lineBreak: false });
        pcx += prxCws[i];
      });
      y += rh18;

      const prxData = [
        ['Exame Externo',    '5 anos',  '1 ano',   fdt(insp?.prox_externo || eq.prox_externo || '')],
        ['Exame Interno',    '10 anos', '5 anos',  fdt(insp?.prox_interno || eq.prox_interno || '')],
        ['Teste Hidrostático', '20 anos', '10 anos', fdt(eq.prox_hidro || '')],
      ];
      prxData.forEach((row, ri) => {
        checar(rh18);
        const fill = ri % 2 === 0 ? C.branco : C.cinzaL;
        doc.save().rect(ML, y, TW, rh18).fill(fill)
           .strokeColor('#AAAAAA').lineWidth(0.4).rect(ML, y, TW, rh18).stroke().restore();
        let rx = ML;
        row.forEach((cell, i) => {
          doc.fillColor(C.preto)
             .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
             .text(cell, rx + 4, y + 6,
                   { width: prxCws[i] - 8, align: 'center', lineBreak: false });
          rx += prxCws[i];
        });
        y += rh18;
      });
      sp(3);

      secao('5.2 – DOCUMENTAÇÃO GERADA PELA INSPEÇÃO');
      const docs2: string[] = ['Relatório de Inspeção;'];
      if (insp?.art) {
        const artFile = insp.art_filename ? ' (PDF anexo)' : '';
        docs2.push(`Anotação de Responsabilidade Técnica (ART) nº ${insp.art}${artFile};`);
      } else if (insp?.art_filename) {
        docs2.push('Anotação de Responsabilidade Técnica (ART) – PDF anexo;');
      }
      instrumentos.forEach(im => {
        const certNum = im.certificado_numero ? ` nº ${im.certificado_numero}` : '';
        const validade = im.validade_calibracao ? ` (validade ${fdt(im.validade_calibracao)})` : '';
        const anexo = im.certificado_filename ? ' – PDF anexo' : '';
        docs2.push(`Certificado de calibração ${im.nome}${certNum}${validade}${anexo};`);
      });

      // Documentação complementar (dispositivos cadastrados na inspeção)
      const docsComplementares: any[] = insp
        ? db.prepare(`
            SELECT * FROM inspecao_dispositivos_seguranca
            WHERE inspecao_id = ?
            ORDER BY criado_em
          `).all(insp.id)
        : [];
      docsComplementares.forEach((d: any) => {
        const tipo = d.tipo || 'Documento complementar';
        const desc = d.descricao ? ` – ${d.descricao}` : '';
        const certNum = d.certificado_numero ? ` nº ${d.certificado_numero}` : '';
        const validade = d.validade_calibracao ? ` (validade ${fdt(d.validade_calibracao)})` : '';
        const anexo = d.certificado_filename ? ' – PDF anexo' : '';
        docs2.push(`${tipo}${desc}${certNum}${validade}${anexo};`);
      });

      // Anexos avulsos (PDF/JPG/PNG)
      const docsAvulsos: any[] = insp
        ? db.prepare(`
            SELECT * FROM inspecao_anexos_seguranca
            WHERE inspecao_id = ?
            ORDER BY criado_em
          `).all(insp.id)
        : [];
      docsAvulsos.forEach((a: any) => {
        const nome = a.descricao || a.nome_original || 'Documento complementar';
        const tipoArquivo = a.mimetype && /image/.test(a.mimetype) ? ' – imagem anexa' : ' – PDF anexo';
        docs2.push(`${nome}${tipoArquivo};`);
      });

      if (docs2.length === 1) {
        // Só "Relatório de Inspeção;" — nem ART nem nada.
        docs2.push('Registro no Livro de Segurança;');
      }
      docs2.forEach(d => {
        checar(20);
        doc.fillColor(C.preto).font('Helvetica').fontSize(10).text(d, ML, y, { width: TW });
        y = doc.y + 3;
      });

      // Detalhe dos instrumentos: tabela com dados de calibração
      if (instrumentos.length > 0) {
        sp(4);
        subSecao('Instrumentos de medição utilizados');
        const iCws = [TW * 0.30, TW * 0.18, TW * 0.16, TW * 0.18, TW * 0.18];
        const iHdrs = ['Instrumento', 'Nº Série', 'Cert.', 'Calibração', 'Validade'];
        const iRh = 18;
        checar(iRh);
        doc.save().rect(ML, y, TW, iRh).fill(C.azul).restore();
        let icx = ML;
        iHdrs.forEach((h, i) => {
          doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(7)
             .text(h, icx + 3, y + 5,
                   { width: iCws[i] - 6, align: 'center', lineBreak: false });
          icx += iCws[i];
        });
        y += iRh;
        instrumentos.forEach((im, ri) => {
          checar(iRh);
          const bg = ri % 2 === 0 ? C.branco : C.cinzaL;
          doc.save().rect(ML, y, TW, iRh).fill(bg)
             .strokeColor('#AAAAAA').lineWidth(0.4).rect(ML, y, TW, iRh).stroke().restore();
          const vals = [
            `${im.nome}${im.modelo ? ' — ' + im.modelo : ''}`,
            im.serie || '—',
            im.certificado_numero || '—',
            fdt(im.data_calibracao),
            fdt(im.validade_calibracao),
          ];
          let vcx = ML;
          vals.forEach((v, i) => {
            doc.fillColor(C.preto).font('Helvetica').fontSize(7)
               .text(String(v), vcx + 3, y + 5,
                     { width: iCws[i] - 6, align: 'center', lineBreak: false });
            vcx += iCws[i];
          });
          y += iRh;
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // RELATÓRIO FOTOGRÁFICO (vem antes da ME)
      // Layout: 2 colunas balanceadas, altura proporcional ao aspect ratio real
      // (orientação EXIF normalizada em fotosPrep). Algoritmo greedy "menor
      // coluna primeiro" para reduzir páginas em branco.
      // ══════════════════════════════════════════════════════════════════════
      if (fotosPrep.length > 0) {
        novaPage();
        secao('6 – RELATÓRIO FOTOGRÁFICO');
        sp(2);

        const GAP_H = 12;
        const GAP_V = 8;
        const LEG_H = 14;
        const slotW = (TW - GAP_H) / 2;
        const MAX_SLOT_H = 320;

        const drawPlaceholder = (x: number, yPos: number, w: number, h: number, msg: string) => {
          doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
             .rect(x, yPos, w, h).stroke().restore();
          doc.fillColor(C.cinzaT).font('Helvetica').fontSize(9)
             .text(msg, x + 6, yPos + h / 2 - 6,
                   { width: w - 12, align: 'center', lineBreak: false });
        };

        const drawFotoSlot = (fp: FotoPrep, x: number, yPos: number, w: number, h: number) => {
          if (fp.buffer) {
            try {
              doc.image(fp.buffer, x, yPos, { fit: [w, h], align: 'center', valign: 'center' });
            } catch {
              drawPlaceholder(x, yPos, w, h, `[Foto ${fp.numero} – inválida]`);
            }
          } else {
            drawPlaceholder(x, yPos, w, h, `[Foto ${fp.numero} – não encontrada]`);
          }
          doc.fillColor(C.cinzaT).font('Helvetica-Oblique').fontSize(8)
             .text(fp.legenda, x, yPos + h + 2, { width: w, align: 'center' });
        };

        let yLeft = y;
        let yRight = y;

        for (const fp of fotosPrep) {
          const aspect = fp.h / fp.w;
          const slotH = Math.min(MAX_SLOT_H, slotW * aspect);
          const totalH = slotH + LEG_H + GAP_V;

          const onLeft = yLeft <= yRight;
          let yCol = onLeft ? yLeft : yRight;
          let xCol = onLeft ? ML : ML + slotW + GAP_H;

          if (yCol + totalH > CONTENT_BOTTOM) {
            novaPage();
            yLeft = y;
            yRight = y;
            yCol = y;
            xCol = ML;
            drawFotoSlot(fp, xCol, yCol, slotW, slotH);
            yLeft = yCol + totalH;
            continue;
          }

          drawFotoSlot(fp, xCol, yCol, slotW, slotH);
          if (onLeft) yLeft = yCol + totalH;
          else        yRight = yCol + totalH;
        }
        y = Math.max(yLeft, yRight);
      }

      // ══════════════════════════════════════════════════════════════════════
      // MEDIÇÃO DE ESPESSURA POR ULTRASSOM
      // ══════════════════════════════════════════════════════════════════════
      if (me) {
        novaPage();
        secao('ENSAIO NÃO DESTRUTIVO – MEDIÇÃO DE ESPESSURA POR ULTRASSOM');
        kvRow([
          ['Equipamento de medição:', me.equipamento_med || '—'],
          ['Cabeçote:',              me.cabecote         || '—'],
          ['Acoplante:',             me.acoplante         || '—'],
          ['Cert. Calibração:',      me.cert_calibracao   || '—'],
          ['Data de Calibração:',    fdt(me.data_calibracao)],
          ['Validade:',              fdt(me.validade_calibracao)],
          ['Metal da Base:',         me.metal_base        || 'ASME SA-36'],
          ['Cond. Superficial:',     me.condicao_superficial || '—'],
          ['Temperatura da Peça:',   me.temperatura_peca ? `${me.temperatura_peca} °C` : '—'],
          ['Inspetor:',              me.inspetor          || '—'],
          ['Norma de Referência:',   me.norma             || 'Petrobras N-1594 | ASME VIII Div.1'],
          ['Procedimento/Rev:',      me.procedimento      || 'VEX ME-001 Rev.:00'],
        ]);
        sp(2);

        // Header tabela de medições
        const mCws = [TW*0.08, TW*0.25, TW*0.12, TW*0.12, TW*0.12, TW*0.31];
        const mHdrs = ['PONTO', 'LOCAL / REGIÃO', 'e NOM. (mm)', 'e MED. (mm)', 'e MÍN. (mm)', 'OBSERVAÇÕES / STATUS'];
        const mRh = 20;

        checar(mRh);
        doc.save().rect(ML, y, TW, mRh).fill(C.verdeH).restore();
        let mcx = ML;
        mHdrs.forEach((h, i) => {
          doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(7)
             .text(h, mcx + 2, y + 6,
                   { width: mCws[i] - 4, align: 'center', lineBreak: false });
          mcx += mCws[i];
        });
        y += mRh;

        pontos.forEach((pt, ri) => {
          checar(mRh);
          const enc  = parseFloat(pt.espessura_encontrada) || 0;
          const minn = parseFloat(pt.espessura_minima)     || 0;
          const ok   = enc >= minn;
          const bg   = !ok ? '#FFCCCC' : (ri % 2 === 0 ? C.branco : C.cinzaL);

          doc.save().rect(ML, y, TW, mRh).fill(bg)
             .strokeColor('#AAAAAA').lineWidth(0.4).rect(ML, y, TW, mRh).stroke().restore();

          const vals = [
            pt.numero,
            pt.regiao   || '—',
            fn(pt.espessura_nominal),
            fn(enc),
            fn(minn),
            ok ? 'Conforme' : 'NÃO CONFORME ⚠',
          ];
          let vcx = ML;
          vals.forEach((v, i) => {
            doc.fillColor(C.preto)
               .font(!ok && i === 5 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
               .text(String(v), vcx + 4, y + 6,
                     { width: mCws[i] - 8, align: 'center', lineBreak: false });
            vcx += mCws[i];
          });
          y += mRh;
        });
        sp(3);

        if (me.croqui_filename) {
          subSecao('CROQUI DO EQUIPAMENTO');
          sp(2);
          checar(145);
          const croquiPath = path.join(process.cwd(), 'uploads', me.croqui_filename);
          if (fs.existsSync(croquiPath)) {
            try {
              doc.image(croquiPath, ML, y, { width: 200, height: 150, fit: [200, 150] });
              y += 155;
            } catch {
              doc.fillColor(C.cinzaT).font('Helvetica').fontSize(10)
                 .text('[Croqui – arquivo inválido]', ML, y + 50);
              y += 60;
            }
          } else {
            doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
               .rect(ML, y, 200, 150).stroke().restore();
            doc.fillColor(C.cinzaT).font('Helvetica').fontSize(10)
               .text('[Croqui – imagem não encontrada]', ML + 10, y + 70);
            y += 160;
          }
          sp(3);
        }

        if (me.conclusao) {
          texto(`Conclusão: ${me.conclusao}`);
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // ÚLTIMA PÁG – CONCLUSÃO
      // ══════════════════════════════════════════════════════════════════════
      checar(200);
      secao('8 – CONCLUSÃO');
      sp(3);
      texto(
        'De acordo com o objetivo desta inspeção, de apresentar os resultados encontrados ' +
        'na mesma, o vaso de pressão descrito nesse relatório encontra-se em boas condições ' +
        'físicas e atende aos requisitos definidos pela Norma NR-13, estando assim apto ' +
        'tecnicamente para ser operado, respeitando as recomendações e condições técnicas ' +
        'de operação, conforme apresentado pelo PH neste relatório.'
      );
      texto(
        `As inspeções periódicas previstas na NR-13 devem ser rigorosamente seguidas nesse ` +
        `período. O Equipamento deverá operar com a pressão Máxima de Trabalho Admissível ` +
        `de ${fn(pmta)} bar.`
      );
      sp(4);

      doc.fillColor(C.preto).font('Helvetica').fontSize(10)
         .text(`Manaus-AM, ${fdt(dtInsp)}`, ML, y, { width: TW, align: 'right' });
      y = doc.y + 24;

      // Linha de assinatura centralizada
      const sigW = 180;
      const sigX = ML + TW / 2 - sigW / 2;
      doc.strokeColor('#AAAAAA').lineWidth(0.5)
         .moveTo(sigX, y).lineTo(sigX + sigW, y).stroke();
      y += 6;
      doc.fillColor(C.preto).font('Helvetica-Bold').fontSize(10)
         .text(phNome, ML, y, { align: 'center', width: TW });
      y = doc.y + 2;
      doc.font('Helvetica').text('Eng. Responsável', ML, y, { align: 'center', width: TW });
      y = doc.y + 2;
      doc.text(`CREA – ${phCrea}`, ML, y, { align: 'center', width: TW });

      doc.end();
    });

    // ── 4. Mesclar anexos no relatório final ─────────────────────────────────
    // Inclui: ART, certificados de instrumentos vinculados, certificado do
    // equipamento de inspeção (ultrassom), certificados de documentação
    // complementar estruturada e anexos avulsos (PDF/JPG/PNG).
    const anexos: { rotulo: string; filename: string; mimetype?: string | null }[] = [];
    if (insp?.art_filename) anexos.push({ rotulo: 'ART', filename: insp.art_filename });
    instrumentos.forEach(im => {
      if (im.certificado_filename) {
        anexos.push({ rotulo: `Certificado de calibração — ${im.nome}`, filename: im.certificado_filename });
      }
    });

    const instrumentoUltrassom: any = me
      ? (me.instrumento_id
        ? db.prepare(`SELECT * FROM instrumentos_medicao WHERE id = ?`).get(me.instrumento_id)
        : (me.equipamento_med
          ? db.prepare(`SELECT * FROM instrumentos_medicao WHERE nome = ?`).get(me.equipamento_med)
          : null))
      : null;

    // Certificado em PDF do equipamento de inspeção (ultrassom) — obrigatório no
    // relatório final. Inclui se houver arquivo carregável; assinatura digital
    // não é mais exigida (regra de negócio: anexar sempre que existir).
    if (instrumentoUltrassom?.certificado_filename) {
      const filename = instrumentoUltrassom.certificado_filename;
      const jaTem = anexos.some(a => a.filename === filename);
      if (!jaTem) {
        const p = path.join(process.cwd(), 'uploads', filename);
        if (fs.existsSync(p)) {
          try {
            const bytes = fs.readFileSync(p);
            // Carregabilidade básica: garante que é um PDF íntegro o suficiente
            // para o pdf-lib copiar páginas. Sem essa checagem mínima, um arquivo
            // corrompido derrubaria o merge inteiro.
            await PDFLibDocument.load(bytes, { ignoreEncryption: true });
            anexos.push({ rotulo: `Certificado de calibração — Ultrassom (${instrumentoUltrassom.nome})`, filename });
          } catch {
            // Arquivo corrompido — ignora silenciosamente; o resto do relatório segue.
          }
        }
      }
    }
    // Documentação complementar estruturada (antiga "dispositivos de segurança")
    const documentos: any[] = insp
      ? db.prepare(`
          SELECT * FROM inspecao_dispositivos_seguranca
          WHERE inspecao_id = ?
          ORDER BY criado_em
        `).all(insp.id)
      : [];
    documentos.forEach((d: any) => {
      if (d.certificado_filename) {
        const rotulo = `Documento — ${d.tipo || 'Documentação complementar'}${d.descricao ? ` (${d.descricao})` : ''}`;
        anexos.push({ rotulo, filename: d.certificado_filename, mimetype: 'application/pdf' });
      }
    });

    // Anexos avulsos (PDF/JPG/PNG) — sempre incluídos
    const anexosAvulsos: any[] = insp
      ? db.prepare(`
          SELECT * FROM inspecao_anexos_seguranca
          WHERE inspecao_id = ?
          ORDER BY criado_em
        `).all(insp.id)
      : [];
    anexosAvulsos.forEach((a: any) => {
      if (!a.filename) return;
      const nome = a.descricao || a.nome_original || 'Documento complementar';
      anexos.push({ rotulo: `Documento — ${nome}`, filename: a.filename, mimetype: a.mimetype || null });
    });

    if (anexos.length === 0) return baseBuffer;

    try {
      const merged = await PDFLibDocument.load(baseBuffer);
      for (const anexo of anexos) {
        const anexoPath = path.join(process.cwd(), 'uploads', anexo.filename);
        if (!fs.existsSync(anexoPath)) continue;
        const isImagem = (anexo.mimetype && /^image\/(jpe?g|png)$/i.test(anexo.mimetype))
                      || /\.(jpe?g|png)$/i.test(anexo.filename);
        try {
          const anexoBytes = fs.readFileSync(anexoPath);
          if (isImagem) {
            // Embute a imagem em uma página A4 e adiciona ao merged
            const isPng = /\.png$/i.test(anexo.filename) || (anexo.mimetype && /png/i.test(anexo.mimetype));
            const img = isPng
              ? await merged.embedPng(anexoBytes)
              : await merged.embedJpg(anexoBytes);
            const page = merged.addPage([PGW, PGH]);
            // Caixa útil descontando margem e área de título/legenda
            const boxX = ML;
            const boxY = ML;
            const boxW = PGW - 2 * ML;
            const boxH = PGH - 2 * ML - 28;
            const scale = Math.min(boxW / img.width, boxH / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const drawX = boxX + (boxW - drawW) / 2;
            // PDF coords: Y cresce de baixo pra cima. Caixa começa em boxY+28 (legenda no rodapé)
            const drawY = boxY + 28 + (boxH - drawH) / 2;
            page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
            page.drawText(anexo.rotulo, {
              x: boxX,
              y: boxY + 12,
              size: 9,
              maxWidth: boxW,
            });
          } else {
            const anexoDoc = await PDFLibDocument.load(anexoBytes, { ignoreEncryption: true });
            const copiedPages = await merged.copyPages(anexoDoc, anexoDoc.getPageIndices());
            copiedPages.forEach(page => merged.addPage(page));
          }
        } catch {
          // Anexo inválido / corrompido — ignora e segue.
        }
      }
      const out = await merged.save();
      return Buffer.from(out);
    } catch {
      // Falha no merge — devolve o relatório principal sem anexos.
      return baseBuffer;
    }
  }
}
