interface ITestProfilerStats
{
	name: string;
	calls: number;
	totalTime: number;
	averageTime: number;
}

interface ITestProfilerBasicStat
{
	totalTime: number;
	calls: number;
}

interface ITestProfilerParentMap
{
	[parentName: string]: ITestProfilerBasicStat;
}

interface ITestProfilerFunctionRecord extends ITestProfilerBasicStat
{
	parentMap: ITestProfilerParentMap;
}

interface ITestProfilerProfilerMap
{
	[functionName: string]: ITestProfilerFunctionRecord;
}

interface IScreepsTestProfilerMemory
{
    started: number;
    totalTime: number;
    cpu: ITestProfilerProfilerMap;
}

interface IScreepsTestMemory extends IScreepsTestProfilerMemory
{
    p: any;
    timers: { [id: string]: number | undefined; };
	runOnce: { [id: string]: 1 };
    runSeq: { [id: string]: { index: number, repeat: number } };
    runAll: { [id: string]: { all: Array<0 | 1>, done?: 1 } };
    asserts: { [line: string]: { s: number, f: number } };
}

interface ITestHarnessMemory
{
    suites: { [id: string]: IScreepsTestMemory }
}

interface Memory
{
    __test_harness: ITestHarnessMemory;
}

interface IScreepsTest
{
    beforeTick(): void;
    run(): boolean;
    afterTick(): void;
    cleanup(): void;
    report(): string;
}

interface Global
{
	testRegistry: Array<{ constructor: new () => IScreepsTest, order: number }>;
	restartTest(): void;
}

declare var global: Global;
