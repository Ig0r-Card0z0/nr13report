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
  secaoBg:   '#F7F7F7', // fundo claro do cabeçalho de seção
  secaoTxt:  '#595959', // texto de baixo contraste sobre fundo claro
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
             c.responsavel,          c.cargo,
             c.logo_filename AS cli_logo
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

    // Pré-processamento da foto de capa — feito AQUI, fora do executor da
    // Promise de montagem do PDF (que é síncrono e não aceita await).
    let capaPrep: { buffer: Buffer; w: number; h: number; legenda: string } | null = null;
    if (fotoCapa?.filename) {
      const capaPath = path.join(process.cwd(), 'uploads', fotoCapa.filename);
      if (fs.existsSync(capaPath)) {
        try {
          const buffer = await sharp(capaPath).rotate().toBuffer();
          const meta = await sharp(buffer).metadata();
          capaPrep = {
            buffer,
            w: meta.width  || 4,
            h: meta.height || 3,
            legenda: fotoCapa.legenda || `Vista geral – ${eq.tag}`,
          };
        } catch {
          capaPrep = null;
        }
      }
    }

    // Logo do cliente — pré-processado aqui pelo mesmo motivo (await).
    // Aparece na capa quando o cliente tiver um logo cadastrado.
    let clienteLogoPrep: { buffer: Buffer; w: number; h: number } | null = null;
    if (eq.cli_logo) {
      const logoPath = path.join(process.cwd(), 'uploads', eq.cli_logo);
      if (fs.existsSync(logoPath)) {
        try {
          // Mantém transparência (PNG) — sem flatten, fundo fica vazado.
          const buffer = await sharp(logoPath).rotate().toBuffer();
          const meta = await sharp(buffer).metadata();
          clienteLogoPrep = {
            buffer,
            w: meta.width  || 4,
            h: meta.height || 3,
          };
        } catch {
          clienteLogoPrep = null;
        }
      }
    }

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
           .moveTo(ML, FTRY - 14).lineTo(ML + TW, FTRY - 14).stroke();

        // Texto do rodapé — linha única, title case, abaixo da linha laranja
        doc.fillColor(C.cinzaT).font('Helvetica').fontSize(7)
           .text(
             'Nort.End - Engenharia e Inspeção  |  92 99387.6271  |  eng.nortend@gmail.com  |  ' +
             'CNPJ: 36.724.646/0001-69  |  CREA-AM: 041725365-6',
             ML, FTRY - 9, { width: TW, align: 'center', lineBreak: false },
           );

        doc.restore();
        // Devolve cursor para o início do conteúdo, caso PDFKit use doc.y depois
        doc.x = ML;
        doc.y = CONTENT_TOP;
        drawingHF = false;
      };

      // ── Barra de seção ────────────────────────────────────────────────────
      const secao = (txt: string) => {
        const label = txt.toUpperCase();
        doc.font('Helvetica-Bold').fontSize(10);
        // Altura ajustada ao texto: evita sobreposição em títulos longos
        const txtH = doc.heightOfString(label, { width: TW - 16 });
        const bh = Math.max(26, txtH + 14);
        checar(bh + 6);
        doc.save()
           .rect(ML, y, TW, bh).fill(C.secaoBg)
           .strokeColor(C.laranja).lineWidth(1.5)
           .moveTo(ML, y + bh).lineTo(ML + TW, y + bh).stroke()
           .restore();
        doc.fillColor(C.secaoTxt).font('Helvetica-Bold').fontSize(10)
           .text(label, ML + 8, y + (bh - txtH) / 2,
                 { width: TW - 16 });
        y += bh + 6;
      };

      // ── Tabela label | valor (2 colunas por linha, 4 colunas totais) ──────
      const kvRow = (pairs: [string, string][], rhMin = 22) => {
        const cw = TW / 4;
        const padX = 5;
        const padY = 5;
        pairs.forEach((_, i) => {
          if (i % 2 !== 0) return;
          // Mede a altura necessária da linha (maior conteúdo entre as 4 células)
          let maxTxtH = 0;
          const cells: string[] = [
            pairs[i][0], pairs[i][1] || '—',
            pairs[i + 1]?.[0] || '', pairs[i + 1]?.[1] || '',
          ];
          cells.forEach((c, ci) => {
            if (!c) return;
            doc.font(ci % 2 === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
            const h = doc.heightOfString(c, { width: cw - 2 * padX });
            if (h > maxTxtH) maxTxtH = h;
          });
          const rh = Math.max(rhMin, maxTxtH + 2 * padY);
          checar(rh);
          const ry = y;
          doc.save()
             .rect(ML,          ry, cw, rh).fill(C.cinzaH)
             .rect(ML + 2 * cw, ry, cw, rh).fill(C.cinzaH)
             .restore();
          doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
             .rect(ML, ry, TW, rh).stroke().restore();
          doc.fillColor(C.preto).font('Helvetica-Bold').fontSize(9)
             .text(pairs[i][0], ML + padX, ry + padY,
                   { width: cw - 2 * padX });
          doc.font('Helvetica')
             .text(pairs[i][1] || '—', ML + cw + padX, ry + padY,
                   { width: cw - 2 * padX });
          if (pairs[i + 1]) {
            doc.font('Helvetica-Bold')
               .text(pairs[i + 1][0], ML + 2 * cw + padX, ry + padY,
                     { width: cw - 2 * padX });
            doc.font('Helvetica')
               .text(pairs[i + 1][1] || '—', ML + 3 * cw + padX, ry + padY,
                     { width: cw - 2 * padX });
          }
          y += rh;
        });
      };

      // ── Checklist header ──────────────────────────────────────────────────
      const CWS = [TW*0.06, TW*0.52, TW*0.14, TW*0.28];
      const HDRS = ['Nº', 'Descrição', 'Resultado', 'Observações'];

      const chkHdr = () => {
        checar(24);
        const rh = 24;
        doc.save().rect(ML, y, TW, rh).fill(C.azul).restore();
        let cx = ML;
        HDRS.forEach((h, i) => {
          doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(9)
             .text(h, cx + 4, y + 7,
                   { width: CWS[i] - 8, align: 'center', lineBreak: false });
          cx += CWS[i];
        });
        y += rh;
      };

      const chkItem = (n: number, desc: string, sim: boolean, obs = '') => {
        const padX = 4;
        const padY = 6;
        const resultadoTxt = sim ? '(x) Sim\n( ) Não' : '( ) Sim\n(x) Não';
        // Mede a altura de cada coluna que pode quebrar linha
        doc.font('Helvetica').fontSize(9);
        const descH = doc.heightOfString(desc, { width: CWS[1] - 2 * padX });
        const obsH  = obs ? doc.heightOfString(obs, { width: CWS[3] - 2 * padX }) : 0;
        const resH  = doc.heightOfString(resultadoTxt, { width: CWS[2] - 2 * padX });
        const rh = Math.max(34, descH + 2 * padY, obsH + 2 * padY, resH + 2 * padY);
        checar(rh);
        const bg = n % 2 === 0 ? C.cinzaL : C.branco;
        doc.save().rect(ML, y, TW, rh).fill(bg)
           .strokeColor('#CCCCCC').lineWidth(0.3).rect(ML, y, TW, rh).stroke().restore();

        let cx = ML;
        // Nº (centralizado verticalmente)
        doc.fillColor(C.preto).font('Helvetica').fontSize(9)
           .text(String(n), cx + 2, y + (rh - 10) / 2,
                 { width: CWS[0] - 4, align: 'center', lineBreak: false });
        cx += CWS[0];
        // Descrição
        doc.font('Helvetica').fontSize(9)
           .text(desc, cx + padX, y + padY, { width: CWS[1] - 2 * padX });
        cx += CWS[1];
        // Resultado
        doc.fontSize(9)
           .text(resultadoTxt, cx + 2, y + (rh - resH) / 2,
                 { width: CWS[2] - 4, align: 'center' });
        cx += CWS[2];
        // Observações
        doc.fontSize(9)
           .text(obs || '', cx + padX, y + padY, { width: CWS[3] - 2 * padX });
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
      // Ordem: título → logo do cliente → foto do equipamento → identificação
      // Distribuição harmônica: mede a altura de todos os blocos, calcula o
      // espaço livre da página e o reparte como respiros proporcionais.
      // ══════════════════════════════════════════════════════════════════════
      novaPage();

      // ── Pré-cálculo das dimensões de cada bloco ──────────────────────────
      // Título (2 linhas de 10pt)
      doc.font('Helvetica-Bold').fontSize(10);
      const tituloLnH = doc.currentLineHeight();
      const tituloH   = tituloLnH * 2 + 6;

      // Logo do cliente
      let logoDrawW = 0, logoDrawH = 0;
      if (clienteLogoPrep) {
        const logoBoxW = 210, logoBoxH = 80;
        const lScale = Math.min(logoBoxW / clienteLogoPrep.w, logoBoxH / clienteLogoPrep.h);
        logoDrawW = clienteLogoPrep.w * lScale;
        logoDrawH = clienteLogoPrep.h * lScale;
      }

      // Foto do equipamento + legenda
      let fotoDrawW = 0, fotoDrawH = 0, fotoLegH = 0;
      let capaLegTxt = '';
      if (capaPrep) {
        const boxW = 340, boxH = 250;
        const scale = Math.min(boxW / capaPrep.w, boxH / capaPrep.h);
        fotoDrawW = capaPrep.w * scale;
        fotoDrawH = capaPrep.h * scale;
        capaLegTxt = capaPrep.legenda;
        doc.font('Helvetica-Oblique').fontSize(9);
        fotoLegH = doc.heightOfString(capaLegTxt, { width: TW, align: 'center' }) + 4;
      }

      // Caixa de identificação
      const idH = 78;

      // ── Distribuição do espaço livre ─────────────────────────────────────
      const blocos: number[] = [tituloH];
      if (clienteLogoPrep) blocos.push(logoDrawH);
      if (capaPrep)        blocos.push(fotoDrawH + fotoLegH);
      blocos.push(idH);

      const areaTop    = CONTENT_TOP;
      const areaBottom = CONTENT_BOTTOM;
      const areaH      = areaBottom - areaTop;
      const somaBlocos = blocos.reduce((a, b) => a + b, 0);
      // Espaço livre repartido: um respiro a mais que o nº de blocos
      // (topo + entre cada par + base), com folga maior nas pontas.
      const folga   = Math.max(0, areaH - somaBlocos);
      const nGaps   = blocos.length + 1;
      const gap     = folga / nGaps;

      y = areaTop + gap;

      // ── Título ───────────────────────────────────────────────────────────
      doc.fillColor(C.azul).font('Helvetica-Bold').fontSize(10)
         .text('RELATÓRIO DE INSPEÇÃO', ML, y, { align: 'center', width: TW });
      y = doc.y + 6;
      doc.text('DE SEGURANÇA', ML, y, { align: 'center', width: TW });
      y += tituloLnH + gap;

      // ── Logo do cliente (sem fundo, transparência preservada) ────────────
      if (clienteLogoPrep) {
        const lX = ML + (TW - logoDrawW) / 2;
        doc.image(clienteLogoPrep.buffer, lX, y, { fit: [logoDrawW, logoDrawH] });
        y += logoDrawH + gap;
      }

      // ── Foto do equipamento (sem fundo: caixa branca/vazada) ─────────────
      if (capaPrep) {
        try {
          const imgX = ML + (TW - fotoDrawW) / 2;
          doc.image(capaPrep.buffer, imgX, y, { fit: [fotoDrawW, fotoDrawH] });
          y += fotoDrawH + 4;
          doc.fillColor(C.cinzaT).font('Helvetica-Oblique').fontSize(9)
             .text(capaLegTxt, ML, y, { width: TW, align: 'center' });
          y += fotoLegH - 4 + gap;
        } catch {
          // Imagem inválida, ignora.
        }
      }

      // ── Caixa de identificação ───────────────────────────────────────────
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
        doc.font('Helvetica').fontSize(8.5);
        const vH = doc.heightOfString(v, { width: inspcW2 - 10 });
        const rh = Math.max(20, vH + 10);
        checar(rh);
        doc.save().rect(ML, y, inspcW1, rh).fill(C.cinzaH).restore();
        doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
           .rect(ML, y, TW, rh).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica-Bold').fontSize(8.5)
           .text(l, ML + 5, y + 5, { width: inspcW1 - 10 });
        doc.font('Helvetica')
           .text(v, ML + inspcW1 + 5, y + 5, { width: inspcW2 - 10 });
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
        const cwL = TW * 0.40, cwV = TW * 0.60;
        doc.font('Helvetica').fontSize(8.5);
        const vH = doc.heightOfString(v, { width: cwV - 10 });
        const lH = doc.heightOfString(l, { width: cwL - 10 });
        const rh = Math.max(20, vH + 10, lH + 10);
        checar(rh);
        doc.save().rect(ML, y, cwL, rh).fill(C.cinzaH).restore();
        doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
           .rect(ML, y, TW, rh).stroke().restore();
        doc.fillColor(C.preto).font('Helvetica-Bold').fontSize(8.5)
           .text(l, ML + 5, y + 5, { width: cwL - 10 });
        doc.font('Helvetica')
           .text(v, ML + cwL + 5, y + 5, { width: cwV - 10 });
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
        const iRhHdr = 20;
        checar(iRhHdr);
        doc.save().rect(ML, y, TW, iRhHdr).fill(C.azul).restore();
        let icx = ML;
        iHdrs.forEach((h, i) => {
          doc.fillColor(C.branco).font('Helvetica-Bold').fontSize(7.5)
             .text(h, icx + 3, y + 6,
                   { width: iCws[i] - 6, align: 'center', lineBreak: false });
          icx += iCws[i];
        });
        y += iRhHdr;
        instrumentos.forEach((im, ri) => {
          const bg = ri % 2 === 0 ? C.branco : C.cinzaL;
          const vals = [
            `${im.nome}${im.modelo ? ' — ' + im.modelo : ''}`,
            im.serie || '—',
            im.certificado_numero || '—',
            fdt(im.data_calibracao),
            fdt(im.validade_calibracao),
          ];
          // Altura ajustada ao maior conteúdo da linha
          let cellH = 0;
          vals.forEach((v, i) => {
            doc.font('Helvetica').fontSize(7.5);
            const h = doc.heightOfString(String(v), { width: iCws[i] - 8 });
            if (h > cellH) cellH = h;
          });
          const iRh = Math.max(18, cellH + 8);
          checar(iRh);
          doc.save().rect(ML, y, TW, iRh).fill(bg)
             .strokeColor('#AAAAAA').lineWidth(0.4).rect(ML, y, TW, iRh).stroke().restore();
          let vcx = ML;
          vals.forEach((v, i) => {
            const txt = String(v);
            doc.font('Helvetica').fontSize(7.5);
            const h = doc.heightOfString(txt, { width: iCws[i] - 8 });
            doc.fillColor(C.preto).font('Helvetica').fontSize(7.5)
               .text(txt, vcx + 4, y + (iRh - h) / 2,
                     { width: iCws[i] - 8, align: 'center' });
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

        // ── Layout 2 colunas com CAIXA UNIFORME ──────────────────────────────
        // Cada foto ocupa uma caixa de dimensões fixas e idênticas. A imagem é
        // centralizada dentro da caixa preservando proporção (fit isolado),
        // portanto nunca é distorcida. Logo abaixo da caixa há um campo de
        // legenda dedicado, com altura própria, que não invade a foto nem a
        // linha de baixo.
        const GAP_H   = 14;             // espaço horizontal entre colunas
        const GAP_V   = 14;             // espaço vertical entre itens
        const PAD_IMG = 4;              // respiro interno da caixa de foto
        const LEG_PAD = 4;              // respiro interno do campo de legenda
        const slotW   = (TW - GAP_H) / 2;
        const BOX_H   = 200;            // altura fixa e uniforme da caixa de foto

        // Calcula a altura do campo de legenda baseada na legenda mais longa,
        // para que TODAS as caixas fiquem alinhadas na mesma grade.
        doc.font('Helvetica-Oblique').fontSize(8.5);
        let legBodyH = 0;
        for (const fp of fotosPrep) {
          const h = doc.heightOfString(`Foto ${fp.numero}: ${fp.legenda}`,
                                       { width: slotW - 2 * LEG_PAD });
          if (h > legBodyH) legBodyH = h;
        }
        const LEG_H   = Math.max(20, legBodyH + 2 * LEG_PAD);
        const ITEM_H  = BOX_H + LEG_H + GAP_V;   // altura total de um item

        const drawPlaceholder = (x: number, yPos: number, w: number, h: number, msg: string) => {
          doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
             .rect(x, yPos, w, h).stroke().restore();
          doc.fillColor(C.cinzaT).font('Helvetica').fontSize(9)
             .text(msg, x + 6, yPos + h / 2 - 6,
                   { width: w - 12, align: 'center', lineBreak: false });
        };

        // Desenha a caixa da foto (uniforme) + campo de legenda dedicado.
        const drawFotoSlot = (fp: FotoPrep, x: number, yPos: number) => {
          // 1) Moldura da caixa de foto
          doc.save().strokeColor('#AAAAAA').lineWidth(0.5)
             .rect(x, yPos, slotW, BOX_H).stroke().restore();

          // 2) Imagem centralizada na caixa, SEM distorção (fit isolado)
          if (fp.buffer) {
            try {
              const availW = slotW - 2 * PAD_IMG;
              const availH = BOX_H - 2 * PAD_IMG;
              const scale  = Math.min(availW / fp.w, availH / fp.h);
              const drawW  = fp.w * scale;
              const drawH  = fp.h * scale;
              const imgX   = x + (slotW - drawW) / 2;
              const imgY   = yPos + (BOX_H - drawH) / 2;
              doc.image(fp.buffer, imgX, imgY, { fit: [drawW, drawH] });
            } catch {
              drawPlaceholder(x, yPos, slotW, BOX_H, `[Foto ${fp.numero} – inválida]`);
            }
          } else {
            drawPlaceholder(x, yPos, slotW, BOX_H, `[Foto ${fp.numero} – não encontrada]`);
          }

          // 3) Campo de legenda dedicado, logo abaixo da caixa
          const legY = yPos + BOX_H;
          doc.save()
             .rect(x, legY, slotW, LEG_H).fill(C.cinzaL)
             .strokeColor('#CCCCCC').lineWidth(0.4)
             .rect(x, legY, slotW, LEG_H).stroke()
             .restore();
          doc.fillColor(C.cinzaT).font('Helvetica-Oblique').fontSize(8.5)
             .text(`Foto ${fp.numero}: ${fp.legenda}`,
                   x + LEG_PAD, legY + LEG_PAD,
                   { width: slotW - 2 * LEG_PAD, align: 'center' });
        };

        // Itera em pares (linha a linha) — grade uniforme, colunas alinhadas.
        for (let i = 0; i < fotosPrep.length; i += 2) {
          if (y + ITEM_H > CONTENT_BOTTOM) {
            novaPage();
          }
          const rowY = y;
          drawFotoSlot(fotosPrep[i], ML, rowY);
          if (fotosPrep[i + 1]) {
            drawFotoSlot(fotosPrep[i + 1], ML + slotW + GAP_H, rowY);
          }
          y = rowY + ITEM_H;
        }
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
          const enc  = parseFloat(pt.espessura_encontrada) || 0;
          const minn = parseFloat(pt.espessura_minima)     || 0;
          const ok   = enc >= minn;
          const bg   = !ok ? '#FFCCCC' : (ri % 2 === 0 ? C.branco : C.cinzaL);

          const vals = [
            pt.numero,
            pt.regiao   || '—',
            fn(pt.espessura_nominal),
            fn(enc),
            fn(minn),
            ok ? 'Conforme' : 'NÃO CONFORME',
          ];
          // Altura ajustada ao maior conteúdo da linha
          let cellH = 0;
          vals.forEach((v, i) => {
            doc.font('Helvetica').fontSize(7.5);
            const h = doc.heightOfString(String(v), { width: mCws[i] - 8 });
            if (h > cellH) cellH = h;
          });
          const rh = Math.max(20, cellH + 10);
          checar(rh);

          doc.save().rect(ML, y, TW, rh).fill(bg)
             .strokeColor('#AAAAAA').lineWidth(0.4).rect(ML, y, TW, rh).stroke().restore();

          let vcx = ML;
          vals.forEach((v, i) => {
            const txt = String(v);
            doc.font('Helvetica').fontSize(7.5);
            const h = doc.heightOfString(txt, { width: mCws[i] - 8 });
            doc.fillColor(C.preto)
               .font(!ok && i === 5 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
               .text(txt, vcx + 4, y + (rh - h) / 2,
                     { width: mCws[i] - 8, align: 'center' });
            vcx += mCws[i];
          });
          y += rh;
        });
        sp(3);

        if (me.croqui_filename) {
          subSecao('CROQUI DO EQUIPAMENTO');
          sp(2);
          const croquiBoxW = 220;
          const croquiBoxH = 165;
          checar(croquiBoxH + 10);
          const croquiPath = path.join(process.cwd(), 'uploads', me.croqui_filename);
          if (fs.existsSync(croquiPath)) {
            try {
              // fit isolado: a imagem cabe na caixa preservando proporção
              doc.image(croquiPath, ML, y, { fit: [croquiBoxW, croquiBoxH] });
              y += croquiBoxH + 8;
            } catch {
              doc.fillColor(C.cinzaT).font('Helvetica').fontSize(10)
                 .text('[Croqui – arquivo inválido]', ML, y + 50);
              y += 60;
            }
          } else {
            doc.save().strokeColor('#AAAAAA').lineWidth(0.4)
               .rect(ML, y, croquiBoxW, croquiBoxH).stroke().restore();
            doc.fillColor(C.cinzaT).font('Helvetica').fontSize(10)
               .text('[Croqui – imagem não encontrada]', ML + 10,
                     y + croquiBoxH / 2 - 6);
            y += croquiBoxH + 10;
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