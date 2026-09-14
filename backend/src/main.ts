import "reflect-metadata";
import cookieParser from "cookie-parser";
import express from "express";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  // Product/supplier-price/params Excel imports can carry tens of thousands of rows.
  app.use(express.json({ limit: "20mb" }));

  // Same-origin in production (Traefik routes both frontend and /api under one host), so this
  // only matters for local dev when the frontend isn't going through the Vite proxy in vite.config.ts.
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
