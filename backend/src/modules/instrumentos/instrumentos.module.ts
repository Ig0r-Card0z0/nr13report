import { Module } from '@nestjs/common';
import { InstrumentosController } from './instrumentos.controller';
import { InstrumentosService } from './instrumentos.service';

@Module({
  controllers: [InstrumentosController],
  providers: [InstrumentosService],
  exports: [InstrumentosService],
})
export class InstrumentosModule {}
