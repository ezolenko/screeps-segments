import { ScreepsTest } from "../harness/test";
export interface ISegmentsBufferTestMemory {
    lastCacheInitTick: number;
    load: {
        usedSegments: number[];
        readSegments: {
            [id: number]: 1 | undefined;
        };
    };
}
export declare class SegmentsBufferTest extends ScreepsTest<ISegmentsBufferTestMemory> {
    reset(): void;
    beforeTick(): void;
    afterTick(): void;
    private runSetGet(out);
    private runSetGetClear(out);
    private generateData(version, id, size);
    private loadTesting(_out);
    run(): boolean;
}
