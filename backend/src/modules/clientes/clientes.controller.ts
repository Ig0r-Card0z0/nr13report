import {
  BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ClientesService, CreateClienteDto } from './clientes.service';

// Armazenamento em disco — mesmo padrão do módulo de fotos.
const logoStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_, file, cb) => cb(null, `logo-${uuidv4()}${extname(file.originalname)}`),
});

const logoMulter = {
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB é suficiente para um logo
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    // PNG preferencial (transparência); JPG e WEBP também aceitos.
    const ok = /^image\/(png|jpeg|webp)$/.test(file.mimetype);
    cb(null, ok);
  },
};

@Controller('api/clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateClienteDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateClienteDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  // ── Logo do cliente ─────────────────────────────────────────────────────
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', logoMulter))
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo inválido. Envie um PNG, JPG ou WEBP de até 5 MB.');
    }
    return this.service.setLogo(id, file);
  }

  @Delete(':id/logo')
  removeLogo(@Param('id') id: string) {
    return this.service.removeLogo(id);
  }
}