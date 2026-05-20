import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EquipamentosService, CreateEquipamentoDto } from './equipamentos.service';

@Controller('api/equipamentos')
export class EquipamentosController {
  constructor(private readonly service: EquipamentosService) {}

  @Get()
  findAll(@Query('clienteId') clienteId?: string) {
    return this.service.findAll(clienteId);
  }

  @Get('vencimentos')
  vencimentos(@Query('dias') dias?: string) {
    return this.service.findVencimentos(dias ? parseInt(dias) : 90);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateEquipamentoDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateEquipamentoDto>) {
    return this.service.update(id, dto);
  }

  @Patch(':id/foto-capa')
  setFotoCapa(
    @Param('id') id: string,
    @Body('foto_id') fotoId: string | null,
  ) {
    return this.service.setFotoCapa(id, fotoId ?? null);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
