import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RelatoriosService } from './relatorios.service';

/**
 * Monta o header Content-Disposition.
 *
 * Browsers descobriram um filename "tradicional" (`filename="x.pdf"`) e um
 * filename estendido com encoding UTF-8 (`filename*=UTF-8''…` — RFC 5987).
 * Mandamos os dois: o ASCII puro como fallback para clientes antigos, e o
 * UTF-8 para preservar acentos quando o navegador suporta.
 *
 * @param ascii    Nome ASCII puro (já sanitizado pelo service).
 * @param original Nome "bonito" com acentos para o filename estendido. Quando
 *                 ausente, omitimos a parte estendida.
 */
function montarContentDisposition(
  isDownload: boolean,
  ascii: string,
  original?: string,
): string {
  const dispositivo = isDownload ? 'attachment' : 'inline';
  const partes = [dispositivo, `filename="${ascii}"`];
  if (original && original !== ascii) {
    partes.push(`filename*=UTF-8''${encodeURIComponent(original)}`);
  }
  return partes.join('; ');
}

@Controller('api/relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get('pdf/:equipamentoId')
  async gerarPDF(
    @Param('equipamentoId') equipamentoId: string,
    @Query('download') download: string,
    @Query('inspecaoId') inspecaoId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.relatoriosService.gerarPDF(equipamentoId, inspecaoId || undefined);
    const slug = this.relatoriosService.getEquipamentoFilenameSlug(equipamentoId);
    const original = this.relatoriosService.getEquipamentoTag(equipamentoId);
    // Fallback para o id quando o equipamento não tem tag legível.
    const base = slug || `relatorio-${equipamentoId}`;
    const isDownload = download === '1' || download === 'true';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': montarContentDisposition(
        isDownload,
        `${base}.pdf`,
        original ? `${original}.pdf` : undefined,
      ),
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    });

    res.end(buffer);
  }

  @Get('livro/:equipamentoId')
  async gerarAnotacaoLivro(
    @Param('equipamentoId') equipamentoId: string,
    @Query('download') download: string,
    @Query('inspecaoId') inspecaoId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.relatoriosService.gerarAnotacaoLivro(
      equipamentoId,
      inspecaoId || undefined,
    );
    const slug = this.relatoriosService.getEquipamentoFilenameSlug(equipamentoId);
    const original = this.relatoriosService.getEquipamentoTag(equipamentoId);
    const base = slug
      ? `Livro de Registro - ${slug}`
      : `anotacao-livro-${equipamentoId}`;
    const baseUtf8 = original ? `Livro de Registro - ${original}` : undefined;
    const isDownload = download === '1' || download === 'true';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': montarContentDisposition(
        isDownload,
        `${base}.pdf`,
        baseUtf8 ? `${baseUtf8}.pdf` : undefined,
      ),
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    });

    res.end(buffer);
  }
}