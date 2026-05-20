import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MeService, CreateMedicaoDto } from './me.service';

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const multerOptions = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
};

@Controller('api/me')
export class MeController {
  constructor(private readonly service: MeService) {}

  @Get()
  find(@Query('equipamentoId') equipamentoId: string, @Query('inspecaoId') inspecaoId: string) {
    if (inspecaoId) return this.service.findByInspecao(inspecaoId);
    if (!equipamentoId) throw new BadRequestException('equipamentoId é obrigatório.');
    return this.service.findByEquipamento(equipamentoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  upsert(@Body() dto: CreateMedicaoDto) { return this.service.upsert(dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/croqui')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadCroqui(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.service.uploadCroqui(id, file.filename);
  }

  @Delete(':id/croqui')
  removeCroqui(@Param('id') id: string) {
    return this.service.removeCroqui(id);
  }
}
