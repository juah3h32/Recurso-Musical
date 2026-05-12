import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import express from 'express';

const server = express();

export const createHandler = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );
  
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: '*', // For serverless, we handle CORS at the app level or vercel.json
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  
  await app.init();
  return app;
};

// Vercel entry point
export default async (req: any, res: any) => {
  await createHandler(server);
  server(req, res);
};
