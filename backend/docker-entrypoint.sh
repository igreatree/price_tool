#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding admin user (idempotent)..."
node prisma/seed.js

echo "Starting API..."
exec node dist/main.js
