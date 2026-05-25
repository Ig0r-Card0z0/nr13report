import {
  BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FotosService } from './fotos.service';

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const imageMulter = {
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const ok = /^image\/(jpeg|png|webp|gif|heic|heif|tiff|bmp|avif)$/i.test(file.mimetype);
    if (ok) return cb(null, true);
    // Rejeita com erro explícito — evita que o Multer descarte o arquivo em
    // silêncio e o controller receba `file` undefined (causava TypeError 500).
    cb(new BadRequestException(`Formato de imagem não suportado: ${file.mimetype}`), false);
  },
};

@Controller('api/fotos')
export class FotosController {
  constructor(private readonly service: FotosService) {}

  @Get()
  find(@Query('equipamentoId') equipamentoId: string, @Query('inspecaoId') inspecaoId: string) {
    if (inspecaoId) return this.service.findByInspecao(inspecaoId);
    if (!equipamentoId) throw new BadRequestException('equipamentoId é obrigatório.');
    return this.service.findByEquipamento(equipamentoId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', imageMulter))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('equipamentoId') equipamentoId: string,
    @Body('inspecaoId') inspecaoId: string,
    @Body('legenda') legenda: string,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo recebido no upload.');
    return this.service.create(equipamentoId, inspecaoId, file, legenda);
  }

  @Patch(':id/legenda')
  updateLegenda(@Param('id') id: string, @Body('legenda') legenda: string) {
    return this.service.updateLegenda(id, legenda);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
