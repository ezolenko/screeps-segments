import { ScreepsTest } from "./test";
import { logger } from "../harness/logger";

interface ITestRunnerMemory
{
	current: number;
	reports: string[];
}

let testRegistrySorted = false;

class TestRunner extends ScreepsTest<ITestRunnerMemory>
{
	private get current() { return global.testRegistry[this.memory.current]; }
	private currentDone = false;
	private get allDone() { return this.memory.current >= global.testRegistry.length; }

	private test: IScreepsTest;

	constructor()
	{
		super();

		this.memory.current = this.memory.current || 0;
		this.memory.reports = this.memory.reports || [];

		if (!testRegistrySorted)
		{
			global.testRegistry.sort((a, b) => a.order - b.order);
			testRegistrySorted = true;
		}
	}

	public beforeTick()
	{
		if (this.allDone)
		{
			logger.error(`all done`);
			return;
		}

		logger.error(`running ${this.current.constructor.name}, ${this.memory.current}`);

		this.test = new this.current.constructor();

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
		if (this.allDone)
			return;

		this.test.afterTick();

		if (this.currentDone)
		{
			logger.error(`completed ${this.current.constructor.name}`);

			this.memory.reports.push(this.test.report());
			this.test.cleanup();
			this.memory.current++;
		}
	}

	public report()
	{
		return this.memory.reports.join("\n");
	}
}

export function runAllTests()
{
	const runner = new TestRunner();

	runner.beforeTick();

	const res = runner.run();

	runner.afterTick();

	if (res)
		logger.error(runner.report());

	return res;
}

export function TestDefinition(order: number)
{
	return (constructor: new () => IScreepsTest) =>
	{
		if (global.testRegistry === undefined)
		{
			global.testRegistry = [];
		}

		global.testRegistry.push({ constructor, order });
	};
}
