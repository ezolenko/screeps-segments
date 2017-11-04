export interface ITestProfilerBasicStat
{
	totalTime: number;
	calls: number;
}

export interface ITestProfilerParentMap
{
	[parentName: string]: ITestProfilerBasicStat;
}

export interface ITestProfilerFunctionRecord extends ITestProfilerBasicStat
{
	parentMap: ITestProfilerParentMap;
}

export interface ITestProfilerProfilerMap
{
	[functionName: string]: ITestProfilerFunctionRecord;
}

export interface IScreepsTestProfilerMemory
{
	started: number;
	cpu: ITestProfilerProfilerMap;
}

interface IParentStat
{
	name: string;
	calls: number;
	totalTime: number;
	averageTime: number;
}

interface IProfilerStats
{
	name: string;
	calls: number;
	totalTime: number;
	averageTime: number;
	parentStats: IParentStat[];
}

export abstract class TestProfiler
{
	private profiling = true;
	private currentlyExecuting: string;
	private usedElsewhere: number = 0;

	protected onCleanup: Array<() => void> = [];

	protected abstract get m(): IScreepsTestProfilerMemory;

	public beforeTick(): void
	{
		this.profiling = true;
	}

	public afterTick(): void
	{
		this.profiling = false;
	}

	protected cleanupProfiler()
	{
		this.profiling = false;
		this.onCleanup.forEach((c) => c());
		this.onCleanup = [];
	}

	private stats(myMap: ITestProfilerProfilerMap): IProfilerStats[]
	{
		const stats = _.map(myMap, (functionCalls, functionName) =>
		{
			return {
				name: functionName!,
				calls: functionCalls.calls,
				totalTime: functionCalls.totalTime,
				averageTime: functionCalls.totalTime / functionCalls.calls,
				parentStats: _.map(functionCalls.parentMap, (e, name) => (
				{
					name: name!,
					calls: e.calls,
					totalTime: e.totalTime,
					averageTime: e.totalTime / e.calls,
				})).sort((val1, val2) => val2.totalTime - val1.totalTime),
			};
		}).sort((val1, val2) => val2.totalTime - val1.totalTime);

		return stats;
	}

	private lines(stats: IProfilerStats[]): string[]
	{
		const totalTime = _.sum(stats, (e) => e.totalTime);
		const lines: string[] = [];

		_.each(stats, (data) =>
		{
			lines.push(
			[
				data.calls,
				(100 * data.totalTime / totalTime).toFixed(2),
				data.totalTime.toFixed(1),
				data.averageTime.toFixed(5),
				data.name,
			].join("\t\t\t"));

			if (data.parentStats.length > 1)
				_.each(data.parentStats, (p) =>
				{
					if (p.totalTime > data.totalTime * 0.2)
						lines.push(
						[
							p.calls,
							"",
							p.totalTime.toFixed(1),
							p.averageTime.toFixed(5),
							p.name,
						].join("\t\t\t"));
				});
		});
		return lines;
	}

	private header(): string
	{
		return `${["calls", "%", "total", "average", "name"].join("\t\t\t")}`;
	}

	public report(displayResults = 10): string
	{
		const elapsedTicks = Game.time - this.m.started + 1;
		const header = this.header();

		const stats = this.stats(this.m.cpu);
		const footer =
		[
			`Ticks: ${elapsedTicks}`,
		].join("\t");
		return ([] as string[]).concat(header, this.lines(stats).slice(0, displayResults), footer).join("\n");
	}

	private record(parent: string | undefined, label: string, time: number)
	{
		this.usedElsewhere += time;

		if (this.m.cpu[label] === undefined)
		{
			this.m.cpu[label] =
			{
				totalTime: 0,
				calls: 0,
				parentMap: {},
			};
		}

		const stat = this.m.cpu[label];
		stat.calls++;
		stat.totalTime += time;

		if (!parent)
			return;

		const parentString = "  by ".concat(parent);

		if (stat.parentMap[parentString] === undefined)
		{
			stat.parentMap[parentString] =
			{
				totalTime: 0,
				calls: 0,
			};
		}

		const parentStat = stat.parentMap[parentString];
		parentStat.calls++;
		parentStat.totalTime += time;
	}

	protected wrapFunction(originalFunction: Function, label: string)
	{
		const profiler = this;
		return function(this: any)
		{
			if (!profiler.profiling)
				return originalFunction.apply(this, arguments);

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
