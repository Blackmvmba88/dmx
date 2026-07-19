export class DMXUniverse {
  private currentFrame = new Uint8Array(512);
  private nextFrame = new Uint8Array(512);

  /**
   * Set DMX channel value (1-indexed, channel ranges from 1 to 512).
   */
  public setChannel(channel: number, value: number): void {
    if (channel < 1 || channel > 512) {
      throw new Error(`Invalid DMX channel: ${channel}. Must be between 1 and 512.`);
    }
    const safeValue = Math.max(0, Math.min(255, Math.round(value)));
    this.nextFrame[channel - 1] = safeValue;
  }

  /**
   * Get DMX channel value from next stage buffer (1-indexed).
   */
  public getChannel(channel: number): number {
    if (channel < 1 || channel > 512) {
      throw new Error(`Invalid DMX channel: ${channel}. Must be between 1 and 512.`);
    }
    return this.nextFrame[channel - 1];
  }

  /**
   * Get current channel value that is already committed/transmitted.
   */
  public getCommittedChannel(channel: number): number {
    if (channel < 1 || channel > 512) {
      throw new Error(`Invalid DMX channel: ${channel}. Must be between 1 and 512.`);
    }
    return this.currentFrame[channel - 1];
  }

  /**
   * Compare nextFrame with currentFrame, update currentFrame, and return modified channels.
   * @returns Map of changed channels (channel -> new value)
   */
  public commit(): Map<number, number> {
    const changes = new Map<number, number>();
    for (let i = 0; i < 512; i++) {
      if (this.nextFrame[i] !== this.currentFrame[i]) {
        this.currentFrame[i] = this.nextFrame[i];
        changes.set(i + 1, this.nextFrame[i]);
      }
    }
    return changes;
  }

  /**
   * Force all channels to be returned as changes (useful on startup or reconnect)
   */
  public forceRefresh(): Map<number, number> {
    const changes = new Map<number, number>();
    for (let i = 0; i < 512; i++) {
      this.currentFrame[i] = this.nextFrame[i];
      changes.set(i + 1, this.nextFrame[i]);
    }
    return changes;
  }

  /**
   * Reset all nextFrame values to 0
   */
  public blackout(): void {
    this.nextFrame.fill(0);
  }

  /**
   * Set all nextFrame values to 255
   */
  public fullOn(): void {
    this.nextFrame.fill(255);
  }

  /**
   * Get a copy of the next frame buffer (stage buffer)
   */
  public getBuffer(): Uint8Array {
    return new Uint8Array(this.nextFrame);
  }

  /**
   * Get a copy of the currently committed frame buffer
   */
  public getCommittedBuffer(): Uint8Array {
    return new Uint8Array(this.currentFrame);
  }
}
