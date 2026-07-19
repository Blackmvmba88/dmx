"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DMXUniverse = void 0;
class DMXUniverse {
    currentFrame = new Uint8Array(512);
    nextFrame = new Uint8Array(512);
    /**
     * Set DMX channel value (1-indexed, channel ranges from 1 to 512).
     */
    setChannel(channel, value) {
        if (channel < 1 || channel > 512) {
            throw new Error(`Invalid DMX channel: ${channel}. Must be between 1 and 512.`);
        }
        const safeValue = Math.max(0, Math.min(255, Math.round(value)));
        this.nextFrame[channel - 1] = safeValue;
    }
    /**
     * Get DMX channel value from next stage buffer (1-indexed).
     */
    getChannel(channel) {
        if (channel < 1 || channel > 512) {
            throw new Error(`Invalid DMX channel: ${channel}. Must be between 1 and 512.`);
        }
        return this.nextFrame[channel - 1];
    }
    /**
     * Get current channel value that is already committed/transmitted.
     */
    getCommittedChannel(channel) {
        if (channel < 1 || channel > 512) {
            throw new Error(`Invalid DMX channel: ${channel}. Must be between 1 and 512.`);
        }
        return this.currentFrame[channel - 1];
    }
    /**
     * Compare nextFrame with currentFrame, update currentFrame, and return modified channels.
     * @returns Map of changed channels (channel -> new value)
     */
    commit() {
        const changes = new Map();
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
    forceRefresh() {
        const changes = new Map();
        for (let i = 0; i < 512; i++) {
            this.currentFrame[i] = this.nextFrame[i];
            changes.set(i + 1, this.nextFrame[i]);
        }
        return changes;
    }
    /**
     * Reset all nextFrame values to 0
     */
    blackout() {
        this.nextFrame.fill(0);
    }
    /**
     * Set all nextFrame values to 255
     */
    fullOn() {
        this.nextFrame.fill(255);
    }
    /**
     * Get a copy of the next frame buffer (stage buffer)
     */
    getBuffer() {
        return new Uint8Array(this.nextFrame);
    }
    /**
     * Get a copy of the currently committed frame buffer
     */
    getCommittedBuffer() {
        return new Uint8Array(this.currentFrame);
    }
}
exports.DMXUniverse = DMXUniverse;
