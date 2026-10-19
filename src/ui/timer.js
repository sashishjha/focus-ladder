/**
 * A gentle countdown timer. It never auto-advances the ladder and never
 * shows red; when it ends it simply says so and offers "another five".
 */

export class GentleTimer {
  /**
   * @param {{onTick:(remainingSeconds:number, totalSeconds:number)=>void, onEnd:()=>void, now?:()=>number, setInterval?:typeof setInterval, clearInterval?:typeof clearInterval}} hooks
   */
  constructor(hooks) {
    this.onTick = hooks.onTick;
    this.onEnd = hooks.onEnd;
    this.now = hooks.now || (() => Date.now());
    this.setIntervalFn = hooks.setInterval || ((fn, ms) => setInterval(fn, ms));
    this.clearIntervalFn = hooks.clearInterval || ((id) => clearInterval(id));
    this.total = 0;
    this.endAt = 0;
    this.remainingWhenPaused = 0;
    this.handle = null;
    this.running = false;
  }

  /** @param {number} minutes */
  start(minutes) {
    this.stop();
    this.total = Math.max(1, Math.round(minutes * 60));
    this.endAt = this.now() + this.total * 1000;
    this.running = true;
    this.onTick(this.total, this.total);
    this.handle = this.setIntervalFn(() => this.tick(), 1000);
  }

  tick() {
    const remaining = Math.max(0, Math.round((this.endAt - this.now()) / 1000));
    this.onTick(remaining, this.total);
    if (remaining <= 0) {
      this.stop();
      this.onEnd();
    }
  }

  pause() {
    if (!this.running) return;
    this.remainingWhenPaused = Math.max(0, Math.round((this.endAt - this.now()) / 1000));
    this.stop();
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.endAt = this.now() + this.remainingWhenPaused * 1000;
    this.running = true;
    this.onTick(this.remainingWhenPaused, this.total);
    this.handle = this.setIntervalFn(() => this.tick(), 1000);
  }

  stop() {
    if (this.handle !== null) this.clearIntervalFn(this.handle);
    this.handle = null;
    this.running = false;
  }

  reset() {
    this.stop();
    this.paused = false;
    this.total = 0;
    this.remainingWhenPaused = 0;
  }
}

/**
 * Format seconds as m:ss.
 * @param {number} seconds
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
