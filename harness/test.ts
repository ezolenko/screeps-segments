import { IScreepsTestProfilerMemory, TestProfiler } from "./profiler";
import { logger } from "./logger";
import { SourceMapWrapper } from "./sourcemap";

export interface IScreepsTestMemory extends IScreepsTestProfilerMemory
{
	p: any;
	timers: { [id: string]: number | undefined; };
	runOnce: { [id: string]: 1 };
	runSeq: { [id: string]: { index: number, repeat: number } };
	runAll: { [id: string]: { all: Array<0 | 1>, done?: 1 } };
	asserts: { [line: string]: { s: number, f: number, l: string, c?: string } };
}

export interface ITestHarnessMemory
{
	id: string;
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

export interface IMemoryRoot
{
	memory: ITestHarnessMemory;
	path: string;
}

let root: IMemoryRoot =
{
	get memory(): ITestHarnessMemory { return Memory.__test_harness; },
	set memory(value: ITestHarnessMemory) { Memory.__test_harness = value; },
	path: "Memory.__test_harness",
};

export function overrideMemoryRoot(override: IMemoryRoot)
{
	root = override;
}

export function getCodeId()
{
	return root.memory.id;
}

export function initializeMemory(codeId: string, restart: boolean)
{
	if (root.memory === undefined || root.memory.id !== codeId || restart)
		root.memory = { id: codeId, suites: { } };
}

export abstract class ScreepsTest<M extends {}> extends TestProfiler implements IScreepsTest
{
	constructor(protected sourceMap: SourceMapWrapper)
	{
		super();
		if (root.memory.suites[this.constructor.name] === undefined)
		{
			logger.info(`creating ${root.path}[${this.constructor.name}]`);
			root.memory.suites[this.constructor.name] =
			{
				p: {},
				cpu: {},
				started: Game.time,
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
		return root.memory.suites[this.constructor.name].p as M;
	}

	protected get m()
	{
		return root.memory.suites[this.constructor.name];
	}

	public beforeTick()
	{
		super.beforeTick();
		this.intents.clear();
	}

	public afterTick()
	{
		this.intents.forEach((i) => i());
		super.afterTick();
	}

	public cleanup()
	{
		delete root.memory.suites[this.constructor.name];
	}

	protected timer(opts: { fireFirst?: boolean; interval: (() => number) | number }, cb: () => boolean): boolean
	{
		const id = this.sourceMap.getFileLine(1, false).final;

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
		const id = this.sourceMap.getFileLine(1, false).final;

		if (this.m.runOnce[id] !== 1 && cb())
			this.m.runOnce[id] = 1;

		return this.m.runOnce[id] === 1;
	}

	protected runSequence(times: number, cb: Array<(iteration: number) => boolean>): boolean
	{
		const id = this.sourceMap.getFileLine(1, false).final;

		if (this.m.runSeq[id] === undefined)
			this.m.runSeq[id] = { index: 0, repeat: 0 };

		const entry = this.m.runSeq[id];

		if (entry.repeat >= times)
			return true;

		if (entry.index < cb.length && cb[entry.index](entry.repeat))
			entry.index += 1;

		if (entry.index >= cb.length)
		{
			entry.repeat++;
			entry.index = 0;
		}

		return entry.repeat >= times;
	}

	protected runAll(cbs: Array<() => boolean>): boolean
	{
		const id = this.sourceMap.getFileLine(1, false).final;

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

	protected assert(expression: boolean, comment?: string): void
	{
		const pos = this.sourceMap.getFileLine(1, true);

		const id = comment !== undefined ? `${comment} (${pos.final})` : pos.final;

		if (this.m.asserts[id] === undefined)
			this.m.asserts[id] = { s: 0, f: 0, l: this.sourceMap.makeVscLink(pos), c: pos.code };

		const entry = this.m.asserts[id];

		if (expression)
			entry.s++;
		else
			entry.f++;
	}

	public report()
	{
		const asserts = _.map(this.m.asserts, (entry) => `${entry.c} // ${entry.l}\n\tsucceeded: ${entry.s}, failed: ${entry.f}`);

		const profiler = super.report();

		return `${this.constructor.name}:\n${asserts.join("\n")}\n${profiler}\n=============================\n`;
	}
}
