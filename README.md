# price-tool

Инструмент ценообразования для маркетплейсов. Backend — NestJS + Prisma + PostgreSQL, frontend — React/Vite/Mantine. Разворачивается через Docker Compose с Traefik (автоматический HTTPS через Let's Encrypt).

## Структура репозитория

```
backend/    NestJS API (Prisma + PostgreSQL)
frontend/   React SPA
tables/     Примеры Excel-файлов для импорта
docker-compose.yml
.env.example
```

## Локальная разработка (без Docker)

1. Поднимите Postgres любым способом (например `docker run -d -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=price_tool -p 5432:5432 postgres:16-alpine`).
2. `cd backend && cp .env.example .env` — поправьте `DATABASE_URL`, если порт/база отличаются.
3. `cd backend && npm install && npx prisma migrate dev && npm run seed && npm run start:dev` — поднимет API на `http://localhost:3000`.
4. `cd frontend && npm install && npm run dev` — поднимет фронтенд на `http://localhost:5173` (запросы к `/api` проксируются на `localhost:3000`, см. `vite.config.ts`).
5. Откройте `http://localhost:5173`, войдите под `ADMIN_USERNAME`/`ADMIN_PASSWORD` из `backend/.env`.

## Продакшен-деплой на VPS (Docker + Traefik + HTTPS)

Предполагается, что DNS-запись `price.bagini.shop` уже указывает на IP VPS, и на сервере установлен Docker с Compose plugin.

1. Склонируйте репозиторий на VPS.
2. `cp .env.example .env` и заполните реальными значениями:
   - `DOMAIN` — домен, на котором будет доступно приложение.
   - `ACME_EMAIL` — email для регистрации сертификата Let's Encrypt.
   - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — данные базы.
   - `JWT_SECRET` — сгенерируйте: `openssl rand -base64 32`.
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — единственная учётная запись для входа в приложение (создаётся автоматически при первом запуске).
3. Убедитесь, что порты 80 и 443 на VPS свободны и не заблокированы firewall.
4. `docker compose up -d --build`
5. Проверьте выпуск сертификата: `docker compose logs traefik | grep -i acme` (может занять до минуты).
6. Откройте `https://price.bagini.shop` — должна появиться форма входа.

### Обновление после изменений в коде

```
git pull
docker compose up -d --build
```

Миграции Prisma и (идемпотентный) сев админ-пользователя выполняются автоматически при каждом старте контейнера `backend` — см. `backend/docker-entrypoint.sh`.

### Резервное копирование базы

Данные Postgres лежат в именованном томе `postgres-data`. Дамп:

```
docker compose exec postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup.sql
```

## Безопасность

Приложение защищено логин-формой (JWT-сессия в httpOnly cookie) — без входа под `ADMIN_USERNAME`/`ADMIN_PASSWORD` ни один API-запрос не проходит. Это одна общая учётная запись, отдельного управления пользователями нет.
