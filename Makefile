.PHONY: dev build start stop logs restart update backup help

## Desenvolvimento local (sem Docker)
dev:
	@echo "Iniciando backend e frontend em modo dev..."
	@cd backend && npm install && npm run start:dev &
	@cd frontend && npm install && npm run dev

## Build de produção
build:
	cd backend && npm install && npm run build
	cd frontend && npm install && npm run build

## Docker: subir todos os serviços
up:
	docker-compose up -d --build
	@echo "Aguardando serviços..."
	@sleep 5
	@docker-compose ps

## Docker: parar
down:
	docker-compose down

## Docker: logs em tempo real
logs:
	docker-compose logs -f

## Docker: restart
restart:
	docker-compose restart

## PM2: status
status:
	pm2 status

## PM2: logs
pm2-logs:
	pm2 logs --lines 100

## PM2: reiniciar
pm2-restart:
	pm2 reload ecosystem.config.js

## Atualizar (PM2)
update:
	bash update.sh

## Backup manual
backup:
	bash backup.sh

## Instalar dependências de desenvolvimento
install:
	cd backend && npm install
	cd frontend && npm install

help:
	@echo ""
	@echo "Comandos disponíveis:"
	@echo "  make dev         Rodar em modo desenvolvimento (sem Docker)"
	@echo "  make build       Compilar backend e frontend"
	@echo "  make up          Subir com Docker Compose"
	@echo "  make down        Parar Docker"
	@echo "  make logs        Logs do Docker"
	@echo "  make status      Status PM2"
	@echo "  make pm2-logs    Logs PM2"
	@echo "  make update      Atualizar e restartar (PM2)"
	@echo "  make backup      Backup manual do banco"
	@echo ""
