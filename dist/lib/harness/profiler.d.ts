export interface ITestProfilerBasicStat {
    totalTime: number;
    calls: number;
}
export interface ITestProfilerParentMap {
    [parentName: string]: ITestProfilerBasicStat;
}
export interface ITestProfilerFunctionRecord extends ITestProfilerBasicStat {
    parentMap: ITestProfilerParentMap;
}
export interface ITestProfilerProfilerMap {
    [functionName: string]: ITestProfilerFunctionRecord;
}
export interface IScreepsTestProfilerMemory {
    started: number;
    cpu: ITestProfilerProfilerMap;
}
export declare abstract class TestProfiler {
    private profiling;
    private currentlyExecuting;
    private usedElsewhere;
    protected onCleanup: Array<() => void>;
    protected readonly abstract m: IScreepsTestProfilerMemory;
    beforeTick(): void;
    afterTick(): void;
    private stats(myMap);
    private lines(stats);
    private header();
    report(displayResults?: number): string;
    private record(parent, label, time);
    protected trace(fn: Function, target: any, args: IArguments, label: string): any;
    protected profileInstance(o: any, label: string): void;
}
