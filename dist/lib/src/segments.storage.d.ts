import { eSegmentBufferStatus } from "./segments.buffer";
export interface ISegmentStorageMetadata {
    ids: number[];
    v: number;
}
export interface ISegmentStorage {
    version: number;
    initTick: number;
    m: {
        [label: string]: ISegmentStorageMetadata;
    };
    clearCache: {
        [nodeId: string]: {
            [label: string]: 1 | undefined;
        } | undefined;
    };
}
declare global  {
    interface Memory {
        storage: ISegmentStorage;
    }
}
export declare class SegmentStringStorage {
    private version;
    private cache;
    private availableSegments;
    private readonly memory;
    private reinitMemory();
    reset(): void;
    beforeTick(): void;
    afterTick(): number[];
    set(label: string, data: string): void;
    get(label: string): {
        status: eSegmentBufferStatus;
        data?: string;
        partial?: string;
    };
    getIds(label: string): number[] | undefined;
    clear(label: string): void;
    visualize(scale: number): void;
}
export declare const segmentStorage: SegmentStringStorage;
