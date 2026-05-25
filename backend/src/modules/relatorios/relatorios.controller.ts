import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RelatoriosService } from './relatorios.service';

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

    const isDownload = download === '1' || download === 'true';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="relatorio-${equipamentoId}.pdf"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    });

    res.end(buffer);
  }

  @Get('docx/:equipamentoId')
  async gerarDOCX(
    @Param('equipamentoId') equipamentoId: string,
    @Query('download') download: string,
    @Query('inspecaoId') inspecaoId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.relatoriosService.gerarDOCX(equipamentoId, inspecaoId || undefined);

    const isDownload = download === '1' || download === 'true';
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="relatorio-${equipamentoId}.docx"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
    });

    res.end(buffer);
  }
}
