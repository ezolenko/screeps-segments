interface IScreepsTestMemory
{
    p: any;
    t?: { [id: string]: number | undefined; };
	runOnce?: 1;
    runSeq?: number;
    runSeqRepeat?: number;
	runAll?: Array<0 | 1>;
	runAllDone?: 1;
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
}

interface Global
{
    testRegistry: Array<{ constructor: new () => IScreepsTest, order: number }>;
}

declare var global: Global;
