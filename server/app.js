import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { notFound, errorHandler } from './middleware/error.js';

// ES modules have no __dirname, so it has to be rebuilt from import.meta.url.
// Needed below to resolve client/dist relative to THIS file rather than to
// whatever directory the process happened to be started from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

/**
 * This file wires middleware and mounts routers. It contains ZERO business
 * logic - no queries, no validation, no response shaping. That is the MVC
 * line: app.js is configuration, controllers are logic, models are data.
 */

// Render terminates TLS at its proxy and forwards the request over HTTP. Without
// trust proxy, req.secure would be false in production, express-rate-limit
// would see the proxy IP for every visitor, and secure cookies would misbehave.
app.set('trust proxy', 1);

// 10kb cap: every legitimate request here is a small JSON form. Images arrive
// as multipart and are handled by multer, which has its own 5MB limit.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Request logging in development only - on Render this would just be noise in
// a log tail that already has its own request lines.
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Deliberately NO cors(). The React build is served from this same origin, so
// there is no cross-origin request to permit - and nothing to misconfigure.
// In development Vite proxies /api to this port, which is also same-origin
// from the browser's point of view.

// Cheap liveness probe for Render's health check.
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);

// 404 for unmatched API paths, registered BEFORE the static/SPA fallback so an
// API typo returns JSON instead of the React index.html (which would show up
// in the client as the baffling "Unexpected token < in JSON").
app.use('/api', notFound);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');

  app.use(express.static(clientDist));

  /**
   * SPA fallback: any non-API path serves index.html so React Router can
   * handle it client-side.
   *
   * WHY it must be last: it matches everything. Registered any earlier it
   * would shadow the API routes above. This is the single-service trick that
   * removes CORS, cookie SameSite problems, and a second deploy target.
   */
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// The error handler is mounted dead last. Express only reaches a 4-arg
// middleware via next(err), and only if it comes after everything that throws.
app.use(errorHandler);

export default app;
