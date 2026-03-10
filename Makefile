ENV_FILE ?= .env.production
DEPLOY_BRANCH ?= main

.PHONY: bootstrap deploy update rollback logs ps backup restore

bootstrap:
	./scripts/bootstrap-server.sh

deploy:
	ENV_FILE=$(ENV_FILE) DEPLOY_BRANCH=$(DEPLOY_BRANCH) ./scripts/deploy.sh

update:
	ENV_FILE=$(ENV_FILE) DEPLOY_BRANCH=$(DEPLOY_BRANCH) ./scripts/update-app.sh

rollback:
	ENV_FILE=$(ENV_FILE) DEPLOY_BRANCH=$(DEPLOY_BRANCH) ./scripts/rollback.sh

logs:
	docker compose -f docker-compose.prod.yml --env-file $(ENV_FILE) logs -f --tail=200 app db

ps:
	docker compose -f docker-compose.prod.yml --env-file $(ENV_FILE) ps

backup:
	ENV_FILE=$(ENV_FILE) ./scripts/backup-db.sh

restore:
	@if [ -z "$(BACKUP)" ]; then echo "Usage: make restore BACKUP=./backups/starboard-YYYYMMDD-HHMMSSZ.sql.gz"; exit 1; fi
	ENV_FILE=$(ENV_FILE) ./scripts/restore-db.sh $(BACKUP)
