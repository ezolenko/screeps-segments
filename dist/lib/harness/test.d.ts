import { IScreepsTestProfilerMemory, TestProfiler } from "./profiler";
import { SourceMapWrapper } from "./sourcemap";
import { IMemoryRoot } from "../src/memory.root";
export interface IScreepsTestMemory extends IScreepsTestProfilerMemory {
    p: any;
    timers: {
        [id: string]: number | undefined;
    };
    runOnce: {
        [id: string]: 1;
    };
    runSeq: {
        [id: string]: {
            index: number;
            repeat: number;
        };
    };
    runAll: {
        [id: string]: {
            all: Array<0 | 1>;
            done?: 1;
        };
    };
    asserts: {
        [line: string]: {
            s: number;
            f: number;
            l: string;
            c?: string;
            v?: string;
        };
    };
    yield: {
        [id: string]: number | undefined;
    };
}
export interface ITestHarnessMemory {
    id: string;
    suites: {
        [id: string]: IScreepsTestMemory;
    };
}
export interface IScreepsTest {
    beforeTick(): void;
    run(): boolean;
    afterTick(): void;
    cleanup(): void;
    report(): string;
    reset(): void;
}
declare global  {
    interface Memory {
        __test_harness: ITestHarnessMemory;
    }
}
export declare function overrideMemoryRoot(override: IMemoryRoot<ITestHarnessMemory>): void;
export declare function getCodeId(): string;
export declare function initializeMemory(codeId: string, restart: boolean): void;
export declare abstract class ScreepsTest<M extends {}> extends TestProfiler implements IScreepsTest {
    protected sourceMap: SourceMapWrapper;
    constructor(sourceMap: SourceMapWrapper);
    abstract reset(): void;
    abstract run(): boolean;
    private intents;
    protected readonly memory: M;
    protected readonly m: IScreepsTestMemory;
    private initMemory();
    beforeTick(): void;
    afterTick(): void;
    cleanup(): void;
    protected timer(opts: {
        fireFirst?: boolean;
        interval: (() => number) | number;
    }, cb: () => boolean): boolean;
    protected runOnce(cb: () => boolean): boolean;
    protected delayFinish(ticks: number, cb: () => boolean): boolean;
    protected runSequence(times: number, cb: Array<(iteration: number) => boolean>): boolean;
    protected runAll(cbs: Array<() => boolean>): boolean;
    private _assert(expression, comment?, v?);
    protected assert(expression: boolean, comment?: string): void;
    private elipse(data, maxSize);
    protected assertEqual<T>(expression: T, test: T, comment?: string): void;
    protected assertNotEqual<T>(expression: T, test: T, comment?: string): void;
    report(): string;
}
