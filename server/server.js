import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env BEFORE importing anything that reads process.env at module scope
// (config/cloudinary.js decides `cloudinaryEnabled` the moment it is imported).
// This is why app.js is imported dynamically further down instead of at the top.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { default: app } = await import('./app.js');
const { default: connectDB } = await import('./config/db.js');
const { initSockets } = await import('./sockets/index.js');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  // Fail loudly at boot. A missing secret would otherwise make jwt.sign throw
  // on the first login attempt, which looks like a broken login form rather
  // than a misconfigured server.
  console.error('[fatal] JWT_SECRET is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

/**
 * One HTTP server shared by Express and Socket.io.
 *
 * WHY http.createServer explicitly instead of app.listen(): Socket.io needs
 * the underlying server instance to attach its upgrade handler. app.listen()
 * creates that server internally and hands back something we cannot pass to
 * io. Sharing one port is also what keeps the websocket same-origin, so the
 * auth cookie is sent on the handshake with no CORS configuration at all.
 */
const server = http.createServer(app);
initSockets(server);

try {
  // Connect first, listen second: better a loud crash at boot than a server
  // that accepts traffic it cannot serve.
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
} catch (err) {
  console.error('[fatal] could not start:', err.message);
  process.exit(1);
}

/**
 * Last-resort safety nets.
 *
 * WHY exit rather than carry on: after an unhandled rejection the process is
 * in an unknown state, and a zombie instance that returns 500s is worse than a
 * dead one. Render restarts the service automatically, so exiting is a repair.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled rejection:', reason);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  // Render sends SIGTERM on redeploy. Closing gracefully lets in-flight
  // requests finish instead of being cut off mid-response.
  console.log('[server] SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
