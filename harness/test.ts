import { IScreepsTestProfilerMemory, TestProfiler } from "./profiler";
import { logger } from "./logger";

export interface IScreepsTestMemory extends IScreepsTestProfilerMemory
{
	p: any;
	timers: { [id: string]: number | undefined; };
	runOnce: { [id: string]: 1 };
	runSeq: { [id: string]: { index: number, repeat: number } };
	runAll: { [id: string]: { all: Array<0 | 1>, done?: 1 } };
	asserts: { [line: string]: { s: number, f: number } };
}

export interface ITestHarnessMemory
{
	suites: { [id: string]: IScreepsTestMemory };
}

export interface IScreepsTest
{
	beforeTick(): void;
	run(): boolean;
	afterTick(): void;
	cleanup(): void;
	report(): string;
}

declare global
{
	interface Memory
	{
		__test_harness: ITestHarnessMemory;
	}
}

export abstract class ScreepsTest<M extends {}> extends TestProfiler implements IScreepsTest
{
	constructor()
	{
		super();
		if (Memory.__test_harness === undefined)
			Memory.__test_harness = { suites: { } };
		if (Memory.__test_harness.suites[this.constructor.name] === undefined)
		{
			logger.error(`creating Memory.__test_harness.suites[${this.constructor.name}]`);
			Memory.__test_harness.suites[this.constructor.name] =
			{
				p: {},
				cpu: {},
				started: Game.time,
				totalTime: 0,
				timers: {},
				runOnce: {},
				runSeq: {},
				runAll: {},
				asserts: {},
			};
		}
	}

	public abstract run(): boolean;

	private intents: Map<string, () => void> = new Map();

	protected get memory(): M
	{
		return Memory.__test_harness.suites[this.constructor.name].p as M;
	}

	protected get m()
	{
		return Memory.__test_harness.suites[this.constructor.name];
	}

	public beforeTick()
	{
		this.intents.clear();
	}

	public afterTick()
	{
		this.intents.forEach((i) => i());
	}

	public cleanup()
	{
		super.cleanup();
		delete Memory.__test_harness.suites[this.constructor.name];
	}

	protected timer(opts: { fireFirst?: boolean; interval: (() => number) | number }, cb: () => boolean): boolean
	{
		const id = this.getFileLine(1);

		let shouldReset;
		let finished;
		let shouldFire;

		if (!this.m.timers)
			this.m.timers = {};

		const time = this.m.timers[id];

		if (time === undefined && !opts.fireFirst)
			shouldReset = true;

		shouldFire = (time === undefined && opts.fireFirst) || (time !== undefined && Game.time >= time);

		if (shouldFire)
		{
			finished = cb();
			if (finished)
				shouldReset = true;
		}

		if (shouldReset)
		{
			const i = _.isNumber(opts.interval) ? opts.interval : opts.interval();
			this.intents.set(id, () => this.m.timers![id] = Game.time + i);
		}

		return shouldFire;
	}

	protected runOnce(cb: () => boolean): boolean
	{
		const id = this.getFileLine(1);

		if (this.m.runOnce[id] !== 1 && cb())
			this.m.runOnce[id] = 1;

		return this.m.runOnce[id] === 1;
	}

	protected runSequence(times: number, cb: Array<(iteration: number) => boolean>): boolean
	{
		const id = this.getFileLine(1);

		if (this.m.runSeq[id] === undefined)
			this.m.runSeq[id] = { index: 0, repeat: 0 };

		const entry = this.m.runSeq[id];

		if (entry.index < cb.length && cb[entry.index ](entry.repeat))
			entry.index  += 1;

		if (entry.index >= cb.length)
		{
			entry.repeat++;
			entry.index = 0;
		}

		return entry.repeat >= times;
	}

	protected runAll(cbs: Array<() => boolean>): boolean
	{
		const id = this.getFileLine(1);

		if (this.m.runAll[id] === undefined)
			this.m.runAll[id] = { all: [] };

		const entry = this.m.runAll[id];

		if (entry.done === 1)
			return true;

		if (_.all(cbs, (cb, i) =>
		{
			if (entry.all[i] === 1)
				return true;
			if (cb())
				entry.all[i] = 1;
			return false;
		}))
			entry.done = 1;

		return entry.done === 1;
	}

	private getFileLine(upStack: number): string
	{
		const stack = new Error("").stack;
		if (stack !== undefined)
		{
			const lines = stack.split("\n");
			if (lines.length > upStack + 2)
				return lines[upStack + 2];
			else
				throw new Error(`can't get line ${upStack} in stack:\n${stack}`);
		}
		else throw new Error(`can't get call stack`);
	}

	protected assert(expression: boolean, comment?: string): void
	{
		let line = this.getFileLine(1);
		if (comment !== undefined)
			line = `${comment} (${line})`;

		if (this.m.asserts[line] === undefined)
			this.m.asserts[line] = { s: 0, f: 0 };

		const entry = this.m.asserts[line];

		if (expression)
			entry.s++;
		else
			entry.f++;
	}

	public report()
	{
		const asserts = _.map(this.m.asserts, (entry, key) => `${key}: succeeded: ${entry.s}, failed: ${entry.f}`);

		const profiler = super.report();

		return `${this.constructor.name}:\n${asserts.join("\n")}\n${profiler}\n=============================`;
	}
}
