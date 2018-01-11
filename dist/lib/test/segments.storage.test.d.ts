import { ScreepsTest } from "../harness/test";
export declare class SegmentsStorageTest extends ScreepsTest<{}> {
    beforeTick(): void;
    reset(): void;
    afterTick(): void;
    runSetGetClear(_out: {
        onAfterTick?: (() => void) | undefined;
    }): boolean;
    private generateData(version, id, size);
    run(): boolean;
}
