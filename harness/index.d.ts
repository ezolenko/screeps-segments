interface IScreepsTestMemory
{
    p: any;
    timers?: { [id: string]: number | undefined; };
	runOnce?: 1;
    runSeq?: number;
    runSeqRepeat?: number;
	runAll?: Array<0 | 1>;
    runAllDone?: 1;
    cpu:
    {
        [label: string]:
        {
            total: number;
            times: number;
        }
    };
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
	record(label: string, used: number): void;
}

interface Global
{
	testRegistry: Array<{ constructor: new () => IScreepsTest, order: number }>;
	restartTest(): void;
}

declare var global: Global;
