import logger from "@/utils/logger";

type RAFCallback = (time: number, deltaTime: number) => void;

/**
 * Lightweight global RAF manager.
 * All callbacks run in registration order within the same frame.
 */
class RAFManager {
  private callbacks = new Map<string, RAFCallback>();
  private rafId: number | null = null;
  private lastTime = 0;
  private idCounter = 0;

  subscribe(callback: RAFCallback): () => void {
    const id = `raf_${++this.idCounter}`;
    this.callbacks.set(id, callback);

    if (this.rafId === null) {
      this.start();
    }

    return () => {
      this.callbacks.delete(id);
      if (this.callbacks.size === 0) {
        this.stop();
      }
    };
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
