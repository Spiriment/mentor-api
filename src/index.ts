import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { AppDataSource } from './config/data-source';
import { logger } from './config/int-services';
import { createRootRoutes } from './routes/root.route';
import { errorHandler } from './common/middleware/errorHandler';
import { Config } from './common';
import { CronService } from './core/cron.service';
import { WebSocketService } from './services/websocket.service';

const app = express();
const httpServer = createServer(app);

// Configure CORS to allow requests from any origin (for development)
// In production, you should restrict this to specific origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
}));

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  logger.info('📥 Incoming Request', {
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
    hasBody: !!req.body,
    bodyPreview: req.body ? JSON.stringify(req.body).substring(0, 200) : null,
  });
  next();
});

app.use(express.json({ limit: '52mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const port = Config.port || 6802;

async function startServer() {
  const startTime = Date.now();

  try {
    logger.info('Starting API server...');

    // Initialize database connection
    const dbStartTime = Date.now();
    await AppDataSource.initialize();
    logger.info(
      `Database connection established in ${Date.now() - dbStartTime}ms`
    );

    const cronService = new CronService(AppDataSource);
    cronService.startAllCronJobs();
    logger.info('Cron jobs started');

    // Initialize WebSocket service
    const wsStartTime = Date.now();
    const webSocketService = new WebSocketService(httpServer, AppDataSource);
    logger.info(
      `WebSocket service initialized in ${Date.now() - wsStartTime}ms`
    );

    const routesStartTime = Date.now();
    app.use(createRootRoutes());
    logger.info(`Routes initialized in ${Date.now() - routesStartTime}ms`);

    app.use(errorHandler(logger));

    // Listen on all network interfaces (0.0.0.0) to allow connections from other devices
    // This allows the app to connect via your computer's IP address (e.g., 192.168.0.192)
    httpServer.listen(port, '0.0.0.0', () => {
      const totalStartupTime = Date.now() - startTime;
      logger.info(
        `Server is running on 0.0.0.0:${port} with WebSocket support (startup took ${totalStartupTime}ms)`
      );
      logger.info(
        `Server accessible at: http://localhost:${port}/api or http://YOUR_IP:${port}/api`
      );
    });
  } catch (error: any) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
