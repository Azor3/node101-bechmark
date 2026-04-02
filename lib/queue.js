// ============================================================
// TEST QUEUE — one test at a time, configurable cooldown
// ============================================================

export class TestQueue {
  constructor({ cooldownMs = 5 * 60 * 1000 } = {}) {
    this.cooldownMs = cooldownMs;
    this.queue = [];
    this.running = false;
    this.currentSessionId = null;
    this.cooldownEndsAt = null;
    this._listeners = new Set();
    this._nextCallback = null;  // called when queue is ready to start next item
    this._cooldownTimer = null;
    this._cooldownTick = null;
  }

  // fn(item) is called when the queue wants to start a test
  onNext(fn) { this._nextCallback = fn; }

  onUpdate(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this.status()); }

  add(config) {
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.queue.push({ id, config, addedAt: Date.now() });
    this._emit();
    // Kick off immediately if nothing is running and no cooldown
    if (!this.running && !this.cooldownEndsAt) this._tryNext();
    return id;
  }

  remove(id) {
    const before = this.queue.length;
    this.queue = this.queue.filter(item => item.id !== id);
    if (this.queue.length !== before) { this._emit(); return true; }
    return false;
  }

  clear() {
    this.queue = [];
    this._emit();
  }

  status() {
    return {
      running: this.running,
      currentSessionId: this.currentSessionId,
      cooldownEndsAt: this.cooldownEndsAt,
      cooldownMs: this.cooldownMs,
      pending: this.queue.map(item => ({
        id: item.id,
        type: item.config.type || 'benchmark',
        chainId: item.config.chainId,
        chainName: item.config.chainName || item.config.chainId || 'Custom',
        endpoint: item.config.endpoint,
        duration: item.config.duration,
        addedAt: item.addedAt,
      })),
    };
  }

  // Call this when a test starts (either queued or direct)
  markRunning(sessionId) {
    this.running = true;
    this.currentSessionId = sessionId;
    this._clearCooldown();
    this._emit();
  }

  // Call this when a test finishes
  markDone() {
    this.running = false;
    this.currentSessionId = null;

    if (this.queue.length === 0) {
      this._emit();
      return;
    }

    // Start cooldown before running next
    this.cooldownEndsAt = Date.now() + this.cooldownMs;
    this._emit();

    // Emit updates every 10 seconds during cooldown so UI shows countdown
    this._cooldownTick = setInterval(() => this._emit(), 10000);

    this._cooldownTimer = setTimeout(() => {
      this._clearCooldown();
      this._tryNext();
    }, this.cooldownMs);
  }

  _clearCooldown() {
    clearTimeout(this._cooldownTimer);
    clearInterval(this._cooldownTick);
    this._cooldownTimer = null;
    this._cooldownTick = null;
    this.cooldownEndsAt = null;
  }

  _tryNext() {
    if (this.running || this.queue.length === 0) return;
    const item = this.queue.shift();
    this._emit();
    if (this._nextCallback) this._nextCallback(item);
  }
}
