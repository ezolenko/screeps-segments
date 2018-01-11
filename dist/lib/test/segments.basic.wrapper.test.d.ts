import { ScreepsTest } from "../harness/test";
import { SourceMapWrapper } from "../harness/sourcemap";
export interface ISegmentsBasicWrapperTestMemory {
    start?: number;
    clearStart?: number;
    checked?: {
        [id: number]: boolean;
    };
}
export declare class SegmentsBasicWrapperTest extends ScreepsTest<ISegmentsBasicWrapperTestMemory> {
    constructor(sourceMap: SourceMapWrapper);
    reset(): void;
    beforeTick(): void;
    afterTick(): void;
    run(): boolean;
    private restart();
    private fillAllSegments();
    private checkSegments();
    private clearAllSegments();
    private generateData(version, id, size?);
}
