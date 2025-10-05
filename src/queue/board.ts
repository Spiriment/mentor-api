import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";
import { QueueManager } from "./manager";
import { Router } from "express";

export class QueueBoard {
  private queueManager: QueueManager;
  private serverAdapter: ExpressAdapter;
  private router: Router | null = null;
  private static instance: QueueBoard | null = null;
  private initialized: boolean = false;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
    this.serverAdapter = new ExpressAdapter();
  }

  public static getInstance(queueManager: QueueManager): QueueBoard {
    if (!QueueBoard.instance) {
      QueueBoard.instance = new QueueBoard(queueManager);
    }
    return QueueBoard.instance;
  }

  private initializeBoard(): void {
    if (this.initialized) {
      return; // Already initialized
    }

    try {
      const queues = this.queueManager.getQueues();

      console.log(`Bull Board: Found ${queues.length} queues`);

      // Only proceed if we have queues
      if (queues.length === 0) {
        console.warn("No queues found for Bull Board initialization");
        return;
      }

      // Log queue names for debugging
      queues.forEach((queue) => {
        console.log(
          `Bull Board: Initializing adapter for queue: ${queue.name}`
        );
      });

      const queueAdapters = queues.map((queue) => {
        try {
          const adapter = new BullMQAdapter(queue);
          console.log(
            `Bull Board: Successfully created adapter for ${queue.name}`
          );
          return adapter;
        } catch (error) {
          console.error(
            `Bull Board: Failed to create adapter for ${queue.name}:`,
            error
          );
          throw error;
        }
      });

      // Set the base path to match our mounting point - this is crucial for static assets
      this.serverAdapter.setBasePath("/bullboard");

      console.log("Bull Board: Creating Bull Board with adapters");

      createBullBoard({
        queues: queueAdapters,
        serverAdapter: this.serverAdapter,
        options: {
          uiConfig: {
            boardTitle: "aptfuel Queue Dashboard",
          },
        },
      });

      this.router = this.serverAdapter.getRouter();
      this.initialized = true;

      console.log("Bull Board: Successfully initialized");
    } catch (error) {
      console.error("Bull Board: Failed to initialize:", error);
      // Don't throw - let getRouter() handle the fallback
    }
  }

  public getRouter(): Router {
    if (!this.initialized) {
      this.initializeBoard();
    }

    if (!this.router) {
      // Fallback router if initialization failed
      console.warn(
        "Bull Board: Using fallback router due to initialization failure"
      );
      const fallbackRouter = Router();
      fallbackRouter.get("*", (req, res) => {
        console.log(`Bull Board fallback: ${req.method} ${req.originalUrl}`);
        res.status(503).json({
          error: "Bull Board not initialized",
          message: "Queues are not ready yet",
        });
      });
      return fallbackRouter;
    }
    return this.router;
  }

  // Keep this method for backward compatibility but mark as deprecated
  public setupBoard(): Router {
    console.warn("setupBoard() is deprecated, use getRouter() instead");
    return this.getRouter();
  }
}
