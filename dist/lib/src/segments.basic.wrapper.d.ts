import { Grid } from "./segments.visualizer";
export declare class SegmentsBasicWrapper {
    private readRequested;
    private willRead;
    private writeRequested;
    private willWrite;
    private read;
    readonly maxSegments: number;
    readonly maxMemory: number;
    readonly maxActive: number;
    beforeTick(): void;
    afterTick(): void;
    private checkId(id);
    getSegment(id: number): string | undefined;
    saveSegment(id: number, data: string): boolean;
    deleteSegment(id: number): boolean;
    requestSegment(id: number): boolean;
    makeGrid(cellSize?: {
        columns: number;
        rows: number;
    }): Grid;
    visualize(scale: number): void;
}
export declare const segmentWrapper: SegmentsBasicWrapper;
