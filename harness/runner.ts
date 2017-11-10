import { ScreepsTest, IScreepsTest, initializeMemory, getCodeId } from "./test";
import { logger } from "../harness/logger";
import { SourceMapWrapper } from "./sourcemap";

interface ITestRunnerMemory
{
	current: number;
	reports: string[];
}

declare global
{
	interface Global
	{
		testRegistry: Array<{ constructor: new (sourceMap: SourceMapWrapper) => IScreepsTest, order: number }>;
		restartTest(): void;
	}
}

declare var global: Global;

let testRegistrySorted = false;

class TestRunner extends ScreepsTest<ITestRunnerMemory>
{
	private get current() { return global.testRegistry[this.memory.current]; }
	private currentDone = false;
	private get allDone() { return this.memory.current >= global.testRegistry.length; }

	private test: IScreepsTest;

	constructor(sourceMap: SourceMapWrapper)
	{
		super(sourceMap);
	}

	public beforeTick()
	{
		super.beforeTick();

		this.memory.current = this.memory.current || 0;
		this.memory.reports = this.memory.reports || [];
		if (!testRegistrySorted)
		{
			global.testRegistry.sort((a, b) => a.order - b.order);
			testRegistrySorted = true;
			console.log(`sorting test registry`);
		}

		if (this.allDone)
		{
			logger.error(`all done`);
			return;
		}

		this.test = new this.current.constructor(this.sourceMap);

		logger.error(`running ${this.test.constructor.name}, test ${this.memory.current + 1} of ${global.testRegistry.length}`);

		this.test.beforeTick();
	}

	public run()
	{
		if (this.allDone)
			return true;

		this.currentDone = this.test.run();

		return this.currentDone;
	}

	public afterTick()
	{
		if (!this.allDone)
		{
			this.test.afterTick();

			if (this.currentDone)
			{
				logger.error(`completed: ${this.current.constructor.name}`);

				this.memory.reports.push(this.test.report());
				logger.error(`report generated: ${this.current.constructor.name}`);

				this.test.cleanup();
				logger.error(`cleaned up: ${this.current.constructor.name}`);

				this.memory.current++;
			}

			delete this.test;
		}

		super.afterTick();
	}

	public report()
	{
		return this.memory.reports.join("\n");
	}
}

let runner: TestRunner;

export function runAllTests(codeId: string, sourceMap: SourceMapWrapper)
{
	initializeMemory(codeId, false);

	if (runner === undefined)
		runner = new TestRunner(sourceMap);

	runner.beforeTick();

	const res = runner.run();

	runner.afterTick();

	if (res)
		logger.error(runner.report());

	return res;
}

export function TestDefinition(order: number)
{
	return (constructor: new (sourceMap: SourceMapWrapper) => IScreepsTest) =>
	{
		if (global.testRegistry === undefined)
		{
			global.testRegistry = [];
		}

		console.log(`registering test ${constructor.name} ${order}`);
		global.testRegistry.push({ constructor, order });
	};
}

global.restartTest = function()
{
	initializeMemory(getCodeId(), true);
};
