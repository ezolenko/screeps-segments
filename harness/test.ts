export abstract class ScreepsTest<M extends {}> implements IScreepsTest
{
	protected onCleanup: Array<() => void> = [];

	constructor()
	{
		if (Memory.__test_harness === undefined)
			Memory.__test_harness = { suites: { } };
		if (Memory.__test_harness.suites[this.constructor.name] === undefined)
			Memory.__test_harness.suites[this.constructor.name] = { p: {}, cpu: {} };
	}

	public abstract run(): boolean;

	private intents: Map<string, () => void> = new Map();

	protected get memory(): M
	{
		return Memory.__test_harness.suites[this.constructor.name].p as M;
	}

	private get m()
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

	public report(): string
	{
		const grandTotal = _.sum(this.m.cpu, (e) => e.total);
		const lines = _.map(this.m.cpu, (entry, label) => `\t${label}: average ${(entry.total / entry.times).toFixed(3)}, total ${entry.total.toFixed(3)}, calls: ${entry.times}, share: ${(100 * entry.total / grandTotal).toFixed(3)}%`);
		return `${this.constructor.name}:\n${lines.join("\n")}`;
	}

	public cleanup()
	{
		this.onCleanup.forEach((c) => c());
		this.onCleanup = [];
		delete Memory.__test_harness.suites[this.constructor.name];
	}

	protected timer(opts: { id: string; fireFirst?: boolean; interval: (() => number) | number }, cb: () => boolean): boolean
	{
		let shouldReset;
		let finished;
		let shouldFire;

		if (!this.m.timers)
			this.m.timers = {};

		const time = this.m.timers[opts.id];

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
			this.intents.set(opts.id, () => this.m.timers![opts.id] = Game.time + i);
		}

		return shouldFire;
	}

	protected runOnce(cb: () => boolean): boolean
	{
		if (this.m.runOnce !== 1 && cb())
			this.m.runOnce = 1;

		return this.m.runOnce === 1;
	}

	protected runSequence(times: number, cb: Array<(iteration: number) => boolean>): boolean
	{
		this.m.runSeq = this.m.runSeq || 0;
		this.m.runSeqRepeat = this.m.runSeqRepeat || 0;

		if (this.m.runSeq < cb.length && cb[this.m.runSeq](this.m.runSeqRepeat))
			this.m.runSeq += 1;

		if (this.m.runSeq >= cb.length)
		{
			this.m.runSeqRepeat++;
			this.m.runSeq = 0;
		}

		return this.m.runSeqRepeat >= times;
	}

	protected runAll(cb: Array<() => boolean>): boolean
	{
		if (this.m.runAllDone !== 1)
		{
			this.m.runAll = this.m.runAll || [];

			if (_.all(cb, (entry, i) => this.m.runAll![i] ? true : entry()))
				this.m.runAllDone = 1;
		}

		return this.m.runAllDone === 1;
	}

	public record(label: string, used: number)
	{
		if (this.m.cpu[label] === undefined)
			this.m.cpu[label] = { total: used, times: 1 };
		else
		{
			this.m.cpu[label].times++;
			this.m.cpu[label].total += used;
		}
	}

	protected track<T>(label: string, cb: () => T): T
	{
		const start = Game.cpu.getUsed();
		const res = cb();
		this.record(label, Game.cpu.getUsed() - start);

		return res;
	}

	protected profileObject(object: any, label: string)
	{
		const objectToWrap = object.__proto__ ? object.__proto__ : object.prototype ? object.prototype : object;

		if (objectToWrap.__profilerWrapped)
			return objectToWrap;

		Object.getOwnPropertyNames(objectToWrap).forEach((functionName) =>
		{
			const descriptor = Object.getOwnPropertyDescriptor(objectToWrap, functionName);
			if (!descriptor)
				return;

			const hasAccessor = descriptor.get || descriptor.set;
			if (hasAccessor)
				return;

			const isFunction = typeof descriptor.value === "function";
			if (!isFunction)
				return;

			const extendedLabel = `${label}.${functionName}`;
			const originalFunction = objectToWrap[functionName] as Function;
			const profiler = this;
			objectToWrap[functionName] = function()
			{
				const start = Game.cpu.getUsed();
				const result = originalFunction.apply(this, arguments);
				profiler.record(extendedLabel, Game.cpu.getUsed() - start);

				return result;
			};
			this.onCleanup.push(() => objectToWrap[functionName] = originalFunction);
		});

		objectToWrap.__profilerWrapped = true;
		this.onCleanup.push(() => delete objectToWrap.__profilerWrapped);

		return objectToWrap;
	}
}
