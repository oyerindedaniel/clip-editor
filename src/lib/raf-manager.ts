import logger from "@/utils/logger";

type RAFCallback = (time: number, deltaTime: number) => void;

/**
 * Lightweight global RAF manager.
 * All callbacks run in registration order within the same frame.
 */
class RAFManager {
  private callbacks = new Map<string, RAFCallback>();
  private triggerHandlers = new Map<string, RAFCallback>();
  private rafId: number | null = null;
  private lastTime = 0;
  private idCounter = 0;

  /**
   * Subscribe with optional user-provided ID.
   * If no ID provided, auto-generates one.
   * If ID already exists, it will be overwritten.
   */
  subscribe(callback: RAFCallback, id?: string): () => void {
    const finalId = id ?? `raf_auto_${++this.idCounter}`;
    this.callbacks.set(finalId, callback);

    if (this.rafId === null) {
      this.start();
    }

    return () => {
      this.callbacks.delete(finalId);
      if (this.callbacks.size === 0) {
        this.stop();
      }
    };
  }

  /**
   * Register a trigger handler that exists independently of RAF subscription.
   * Use this when you want manual triggers but don't want RAF loop running.
   */
  registerTriggerHandler(id: string, callback: RAFCallback): () => void {
    this.triggerHandlers.set(id, callback);
    return () => {
      this.triggerHandlers.delete(id);
    };
  }

  /**
   * Manually trigger a specific callback by ID.
   * Only works if the RAF was registered with an explicit ID.
   */
  trigger(id: string): void {
    // First try active RAF callback
    let callback = this.callbacks.get(id);

    // Fallback to trigger handler
    if (!callback) {
      callback = this.triggerHandlers.get(id);
    }

    if (!callback) {
      logger.warn(`RAF trigger called for non-existent id: ${id}`);
      return;
    }

    try {
      const now = performance.now();
      const deltaTime = now - this.lastTime || 16;
      callback(now, deltaTime);
    } catch (err) {
      logger.error("RAF manual trigger error:", err);
    }
  }

  private start(): void {
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  private stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTime = 0;
  }

  private tick = (time: number): void => {
    const deltaTime = time - this.lastTime;
    this.lastTime = time;

    // Execute all callbacks in registration order
    this.callbacks.forEach((callback) => {
      try {
        callback(time, deltaTime);
      } catch (err) {
        logger.error("RAF callback error:", err);
      }
    });

    if (this.callbacks.size > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  destroy(): void {
    this.callbacks.clear();
    this.stop();
  }
}

export const globalRAF = new RAFManager();
