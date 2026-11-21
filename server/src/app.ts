import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { ambulanceRouter } from './routes/ambulances';
import { assignmentRouter } from './routes/assignments';
import { authRouter } from './routes/auth';
import { dashboardRouter } from './routes/dashboard';
import { databaseRouter } from './routes/database';
import { emergencyRequestRouter } from './routes/emergencyRequests';
import { healthRouter } from './routes/health';
import { hospitalResourceRouter } from './routes/hospitalResources';
import { hospitalPortalRouter } from './routes/hospitalPortal';
import { hospitalRouter } from './routes/hospitals';
import { patientRouter } from './routes/patient';
import { publicRouter } from './routes/public';
import { queueRouter } from './routes/queue';
import { registrationRouter } from './routes/registration';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // The client reaches PostgreSQL only through these routes.
  app.get('/api', (_req, res) => {
    res.json({
      service: env.serviceName,
      version: env.version,
      sessionHours: env.sessionHours,
      endpoints: [
        'GET  /api/health',
        'GET  /api/public/summary',
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'GET  /api/auth/me',
        'POST /api/auth/register/hospital',
        'POST /api/auth/register/dispatcher',
        'POST /api/auth/register/patient',
        'GET  /api/patient/overview (patient)',
        'GET  /api/patient/hospitals (patient)',
        'POST /api/patient/requests (patient)',
        'GET  /api/patient/requests (patient)',
        'GET/POST /api/patient/prebookings (patient)',
        'PATCH /api/patient/prebookings/:id/cancel (patient)',
        'GET  /api/patient/campaigns (patient)',
        'POST /api/patient/campaigns/:id/read (patient)',
        'GET/PATCH /api/patient/profile (patient)',
        'GET  /api/patient/push/public-key (patient)',
        'POST/DELETE /api/patient/push/subscriptions (patient)',
        'GET  /api/hospital/prebookings (hospital)',
        'PATCH /api/hospital/prebookings/:id (hospital)',
        'GET/POST /api/hospital/campaigns (hospital)',
        'GET  /api/hospital/campaigns/:id/delivery (hospital)',
        'GET  /api/database/overview (dispatcher)',
        'GET  /api/dashboard/dispatcher (dispatcher)',
        'GET  /api/dashboard/hospital (hospital staff)',
        'POST /api/emergency-requests (dispatcher)',
        'GET  /api/emergency-requests (dispatcher)',
        'GET  /api/queue (dispatcher)',
        'GET  /api/ambulances (dispatcher)',
        'POST /api/ambulances (dispatcher)',
        'GET  /api/ambulances/search (dispatcher)',
        'GET  /api/hospitals/match (dispatcher)',
        'GET  /api/hospital/resources (hospital)',
        'PATCH /api/hospital/resources (hospital)',
        'POST /api/hospital/resources/import (hospital)',
        'POST /api/assignments (dispatcher)',
        'POST /api/assignments/:assignmentId/close (dispatcher)',
        'GET  /api/assignments (dispatcher)',
        'WS   /socket.io (authenticated session; change notifications)',
      ],
    });
  });

  app.use('/api/health', healthRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/auth/register', registrationRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/database', databaseRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/emergency-requests', emergencyRequestRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/ambulances', ambulanceRouter);
  app.use('/api/hospitals', hospitalRouter);
  app.use('/api/hospital', hospitalResourceRouter);
  app.use('/api/hospital', hospitalPortalRouter);
  app.use('/api/patient', patientRouter);
  app.use('/api/assignments', assignmentRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
