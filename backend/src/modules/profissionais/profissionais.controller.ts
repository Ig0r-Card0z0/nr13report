import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ProfissionaisService, CreateProfissionalDto } from './profissionais.service';

@Controller('api/profissionais')
export class ProfissionaisController {
  constructor(private readonly service: ProfissionaisService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateProfissionalDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProfissionalDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
