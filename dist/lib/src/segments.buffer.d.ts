export interface ISegmentMetadata {
    cacheMiss: number;
    savedVersion: number;
    lastWrite: number;
    lastRead: number;
    lastReadRequest: number;
    lastWriteRequest: number;
    writeCount: number;
    readCount: number;
    readRequestCount: number;
    writeRequestCount: number;
    setCount: number;
    getCount: number;
}
export interface ISegmentsBufferEntry {
    d: string;
    version: number;
    lastWrite: number;
}
export interface ISegmentBuffer {
    version: number;
    initTick: number;
    metadata: {
        [id: string]: ISegmentMetadata;
    };
    buffer: {
        [id: string]: ISegmentsBufferEntry;
    };
    clearCache: {
        [nodeId: string]: {
            [id: string]: 1 | undefined;
        } | undefined;
    };
}
declare global  {
    interface Memory {
        segments: ISegmentBuffer;
    }
}
export interface ISegmentsCacheEntry {
    d: string;
    metadata: ISegmentMetadata;
    version: number;
}
export interface ISegmentsCache {
    initTick: number;
    c: {
        [id: string]: ISegmentsCacheEntry;
    };
}
export declare enum eSegmentBufferStatus {
    Ready = 0,
    NextTick = 1,
    Delayed = 2,
    Empty = 3,
}
export declare class SegmentBuffer {
    private version;
    private clearDelay;
    private maxBufferSize;
    private cache;
    private readonly memory;
    readonly maxSize: number;
    private reinitMemory();
    reset(): void;
    beforeTick(): void;
    afterTick(): void;
    private getOrCreateMetadata(id);
    getUsedSegments(): number[];
    get(id: number): {
        status: eSegmentBufferStatus;
        data?: string;
    };
    set(id: number, data: string): void;
    clear(id: number): void;
    visualize(scale: number): void;
    forgetAll(): void;
}
export declare const segmentBuffer: SegmentBuffer;
export {};
