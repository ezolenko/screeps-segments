export abstract class TestProfiler
{
	private currentlyExecuting: string;
	private usedElsewhere: number = 0;

	protected onCleanup: Array<() => void> = [];

	protected abstract get m(): IScreepsTestProfilerMemory;

	public cleanup()
	{
		this.onCleanup.forEach((c) => c());
		this.onCleanup = [];
	}

	private stats(myMap: IProfilerMap): IProfilerStats[]
	{
		
	}

	public report(): string
	{
		const elapsedTicks = Game.time - this.m.started + 1;
		
		const grandTotal = _.sum(this.m.cpu, (e) => e.total);
		const lines = _.map(this.m.cpu, (entry, label) => `\t${label}: average ${(entry.total / entry.times).toFixed(3)}, total ${entry.total.toFixed(3)}, calls: ${entry.times}, share: ${(100 * entry.total / grandTotal).toFixed(3)}%`);
		return `${this.constructor.name}:\n${lines.join("\n")}`;
	}

	private record(parent: string | undefined, label: string, time: number)
	{
		this.usedElsewhere += time;

		if (this.m.cpu[label] === undefined)
		{
			this.m.cpu[label] =
			{
				total: time,
				calls: 0,
				parentMap: {},
			};
		}

		const stat = this.m.cpu[label];
		stat.calls++;
		stat.total += time;

		if (!parent)
			return;

		const parentString = "  by ".concat(parent);

		if (stat.parentMap[parentString] === undefined)
		{
			stat.parentMap[parentString] =
			{
				total: time,
				calls: 0,
			};
		}

		const parentStat = stat.parentMap[parentString];
		parentStat.calls++;
		parentStat.total += time;
	}

	protected wrapFunction(originalFunction: Function, label: string)
	{
		const profiler = this;
		return function(this: any)
		{
			const start = Game.cpu.getUsed();
			const usedElsewhereStart = profiler.usedElsewhere;

			const parent = profiler.currentlyExecuting;
			profiler.currentlyExecuting = label;

			const result = originalFunction.apply(this, arguments);

			const end = Game.cpu.getUsed();
			const usedElsewhereEnd = profiler.usedElsewhere;

			profiler.record(parent, label, end - start - (usedElsewhereEnd - usedElsewhereStart));

			profiler.currentlyExecuting = parent;

			return result;
		};
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
			objectToWrap[functionName] = this.wrapFunction(originalFunction, extendedLabel);
			this.onCleanup.push(() => objectToWrap[functionName] = originalFunction);
		});

		objectToWrap.__profilerWrapped = true;
		this.onCleanup.push(() => delete objectToWrap.__profilerWrapped);

		return objectToWrap;
	}
}
