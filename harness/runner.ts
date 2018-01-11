import { ScreepsTest, IScreepsTest, initializeMemory, getCodeId } from "./test";
import { SourceMapWrapper } from "./sourcemap";
import { tracker } from "../src/runtime.tracker";
import { log } from "../lib/lib";

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
		wipeMemory(): void;
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

	public reset()
	{
		//
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
			log.error(`all done`);
			return;
		}

		this.test = new this.current.constructor(this.sourceMap);

		log.error(`running ${this.test.constructor.name}, test ${this.memory.current + 1} of ${global.testRegistry.length}`);

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
				log.error(`completed: ${this.current.constructor.name}`);

				this.memory.reports.push(this.test.report());
				log.error(`report generated: ${this.current.constructor.name}`);

				this.test.cleanup();
				log.error(`cleaned up: ${this.current.constructor.name}`);

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

	tracker.beforeTick();
	log.error(tracker.report());

	let res: boolean;
	try
	{
		runner.beforeTick();
		res = runner.run();
		runner.afterTick();

		if (res)
			log.error(runner.report());
	}
	catch (err)
	{
		console.log(`=====================\n${err.stack}\n=====================\n`);
		res = true;
	}

	tracker.afterTick();
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

global.wipeMemory = function()
{
	Object.keys(Memory).forEach((key) => delete Memory[key]);
};
