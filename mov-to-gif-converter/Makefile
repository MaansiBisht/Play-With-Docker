.PHONY: help dev prod stop clean logs

help:
	@echo "Available commands:"
	@echo "  dev    - Start development environment with hot-reload"
	@echo "  prod   - Start production environment"
	@echo "  stop   - Stop all containers"
	@echo "  clean  - Remove all containers, images, and volumes"
	@echo "  logs   - Show logs from running containers"

dev:
	docker-compose -f docker-compose.dev.yml up --build

prod:
	docker-compose up --build

stop:
	docker-compose down

clean:
	docker-compose down -v --rmi all

logs:
	docker-compose logs -f
