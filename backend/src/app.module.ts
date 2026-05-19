import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { EquipamentosModule } from './modules/equipamentos/equipamentos.module';
import { InspecoesModule } from './modules/inspecoes/inspecoes.module';
import { FotosModule } from './modules/fotos/fotos.module';
import { MeModule } from './modules/me/me.module';
import { InstrumentosModule } from './modules/instrumentos/instrumentos.module';
import { ProfissionaisModule } from './modules/profissionais/profissionais.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    DatabaseModule,
    ClientesModule,
    EquipamentosModule,
    InspecoesModule,
    FotosModule,
    MeModule,
    InstrumentosModule,
    ProfissionaisModule,
    RelatoriosModule,
    DashboardModule,
  ],
  controllers: [AppController],
})
export class AppModule {}