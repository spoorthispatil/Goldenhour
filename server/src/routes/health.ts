import { Router } from 'express';
import { env } from '../config/env';
import { checkDatabase } from '../db/pool';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const database = await checkDatabase();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    service: env.serviceName,
    version: env.version,
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    serverTime: new Date().toISOString(),
    database,
  });
});
