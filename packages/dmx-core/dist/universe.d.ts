export declare class DMXUniverse {
    private currentFrame;
    private nextFrame;
    /**
     * Set DMX channel value (1-indexed, channel ranges from 1 to 512).
     */
    setChannel(channel: number, value: number): void;
    /**
     * Get DMX channel value from next stage buffer (1-indexed).
     */
    getChannel(channel: number): number;
    /**
     * Get current channel value that is already committed/transmitted.
     */
    getCommittedChannel(channel: number): number;
    /**
     * Compare nextFrame with currentFrame, update currentFrame, and return modified channels.
     * @returns Map of changed channels (channel -> new value)
     */
    commit(): Map<number, number>;
    /**
     * Force all channels to be returned as changes (useful on startup or reconnect)
     */
    forceRefresh(): Map<number, number>;
    /**
     * Reset all nextFrame values to 0
     */
    blackout(): void;
    /**
     * Set all nextFrame values to 255
     */
    fullOn(): void;
    /**
     * Get a copy of the next frame buffer (stage buffer)
     */
    getBuffer(): Uint8Array;
    /**
     * Get a copy of the currently committed frame buffer
     */
    getCommittedBuffer(): Uint8Array;
}
