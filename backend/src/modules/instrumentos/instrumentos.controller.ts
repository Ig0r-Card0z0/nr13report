import {
  BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { InstrumentosService, CreateInstrumentoDto } from './instrumentos.service';

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

@Controller('api/instrumentos')
export class InstrumentosController {
  constructor(private readonly service: InstrumentosService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateInstrumentoDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateInstrumentoDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Post(':id/certificado')
  @UseInterceptors(FileInterceptor('file', pdfMulter))
  uploadCertificado(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum PDF enviado.');
    return this.service.uploadCertificado(id, file.filename);
  }

  @Delete(':id/certificado')
  removeCertificado(@Param('id') id: string) {
    return this.service.removeCertificado(id);
  }
}
