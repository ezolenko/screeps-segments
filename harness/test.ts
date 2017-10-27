export abstract class ScreepsTest<M extends {}> implements IScreepsTest
{
	constructor()
	{
		if (Memory.__test_harness === undefined)
			Memory.__test_harness = { suites: { } };
		if (Memory.__test_harness.suites[this.constructor.name] === undefined)
			Memory.__test_harness.suites[this.constructor.name] = { p: {} };
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

	public cleanup()
	{
		delete Memory.__test_harness.suites[this.constructor.name];
	}

	protected timer(opts: { id: string; fireFirst?: boolean; interval: (() => number) | number }, cb: () => boolean): boolean
	{
		let shouldReset;
		let finished;
		let shouldFire;

		if (!this.m.t)
			this.m.t = {};

		const time = this.m.t[opts.id];

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
			this.intents.set(opts.id, () => this.m.t![opts.id] = Game.time + i);
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
}
