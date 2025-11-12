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

// CORS configuration - allow all origins in development
app.use(cors({
  origin: Config.nodeEnv === 'production' 
    ? Config.cors.origin 
    : true, // Allow all origins in development
  credentials: true,
}));
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

    httpServer.listen(port, () => {
      const totalStartupTime = Date.now() - startTime;
      logger.info(
        `Server is running on port ${port} with WebSocket support (startup took ${totalStartupTime}ms)`
      );
    });
  } catch (error: any) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
