import {
  BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query,
  UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { InspecoesService, CreateInspecaoDto } from './inspecoes.service';

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

const pdfMulter = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    cb(null, file.mimetype === 'application/pdf');
  },
};

const anexosSegurancaMulter = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
};

@Controller('api/inspecoes')
export class InspecoesController {
  constructor(private readonly service: InspecoesService) {}

  @Get()
  findByEquipamento(@Query('equipamentoId') equipamentoId: string) {
    return this.service.findByEquipamento(equipamentoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateInspecaoDto) { return this.service.create(dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/art')
  @UseInterceptors(FileInterceptor('file', pdfMulter))
  uploadArt(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum PDF enviado.');
    return this.service.uploadArt(id, file.filename);
  }

  @Delete(':id/art')
  removeArt(@Param('id') id: string) {
    return this.service.removeArt(id);
  }

  @Put(':id/instrumentos')
  setInstrumentos(
    @Param('id') id: string,
    @Body('instrumento_ids') ids: string[],
  ) {
    return this.service.setInstrumentos(id, Array.isArray(ids) ? ids : []);
  }

  @Put(':id/dispositivos-seguranca')
  setDispositivos(
    @Param('id') id: string,
    @Body('dispositivos') dispositivos: any[],
  ) {
    return this.service.setDispositivos(id, Array.isArray(dispositivos) ? dispositivos : []);
  }

  @Post('dispositivos-seguranca/:id/certificado')
  @UseInterceptors(FileInterceptor('file', pdfMulter))
  uploadCertificadoDispositivo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum PDF enviado.');
    return this.service.uploadCertificadoDispositivo(id, file.filename);
  }

  @Delete('dispositivos-seguranca/:id/certificado')
  removeCertificadoDispositivo(@Param('id') id: string) {
    return this.service.removeCertificadoDispositivo(id);
  }

  @Get(':id/anexos-seguranca')
  listAnexosSeguranca(@Param('id') id: string) {
    return this.service.listAnexosSeguranca(id);
  }

  @Post(':id/anexos-seguranca')
  @UseInterceptors(FilesInterceptor('files', 30, anexosSegurancaMulter))
  addAnexosSeguranca(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('Nenhum arquivo enviado.');
    return this.service.addAnexosSeguranca(id, files);
  }

  @Delete('anexos-seguranca/:id')
  removeAnexoSeguranca(@Param('id') id: string) {
    return this.service.removeAnexoSeguranca(id);
  }
}
