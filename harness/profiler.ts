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

// class PrototypeProxyHandler<T extends { [property: string]: any }> implements ProxyHandler<T>
// {
// 	constructor(private profiler: TestProfiler, private label: string) {}

// 	public get(target: T, p: PropertyKey, _receiver: any): any
// 	{
// 		const original = target[p];
// 		console.log(`proxy property: ${this.label}, ${p}`);

// 		if (original instanceof Function)
// 		{
// 			const profiler = this.profiler;
// 			const label = `${this.label}.${p}`;
// 			return function(this: any, ...args: any[])
// 			{
// 				// tslint:disable-next-line:no-string-literal
// 				return profiler["trace"](original, this, args, label);
// 			};
// 		}
// 		else
// 			return original;
// 	}

// 	public set(target: T, p: PropertyKey, value: any, _receiver: any): boolean
// 	{
// 		console.log(`proxy set property: ${this.label}, ${p}`);
// 		target[p] = value;
// 		return true;
// 	}
// }

export abstract class TestProfiler
{
	private profiling = true;
	private currentlyExecuting: string;
	private usedElsewhere: number = 0;

	protected onCleanup: Array<() => void> = [];

	protected abstract get m(): IScreepsTestProfilerMemory;

	public beforeTick(): void
	{
		console.log(`profiler beforeTick for ${this.constructor.name}`);
		this.profiling = true;
	}

	public afterTick(): void
	{
		console.log(`profiler afterTick for ${this.constructor.name}, cleanup: ${this.onCleanup.length}`);
		this.profiling = false;
		this.onCleanup.reverse().forEach((c) => c());
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

		if (parent === undefined)
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

	protected trace(fn: Function, target: any, a: any[], label: string): any
	{
		if (!this.profiling)
			return fn.apply(target, a);

		const start = Game.cpu.getUsed();
		const usedElsewhereStart = this.usedElsewhere;

		const parent = this.currentlyExecuting;
		this.currentlyExecuting = label;

		const result = fn.apply(target, arguments);

		const end = Game.cpu.getUsed();
		const usedElsewhereEnd = this.usedElsewhere;

		this.record(parent, label, end - start - (usedElsewhereEnd - usedElsewhereStart));

		this.currentlyExecuting = parent;

		return result;
	}

	protected profileInstance(o: any, label: string): void
	{
		if (o === undefined)
			return;

		console.log(`profiling ${label}`);

		const profiler = this;
		Object.getOwnPropertyNames(o.__proto__).forEach((key) =>
		{
			const fullLabel = `${label}.${key}`;

			if (key === "constructor")
				return;

			const value = o.__proto__[key];
			console.log(`profiling ${fullLabel}`);

			if (_.isFunction(value))
			{
				console.log(`wrapping ${fullLabel}`);
				o.__proto__[key] = function(this: any, ...args: any[])
				{
					console.log(`called ${fullLabel}`);
					// tslint:disable-next-line:no-string-literal
					return profiler["trace"](value, this, args, fullLabel);
				};
				this.onCleanup.push(() =>
				{
					console.log(`unprofiling ${fullLabel}`);
					o.__proto__[key] = value;
				});
			}

		});

		// let key: any;
		// for (key in o.__proto__)
		// {
		// 	console.log(`profiling ${label}.${key}`);

		// 	if (o.hasOwnProperty(key) || o.__proto__.hasOwnProperty(key))
		// 	{
		// 		const value = o[key];
		// 		const fullLabel = `${label}.${key}`;
		// 		if (_.isFunction(value))
		// 		{
		// 			console.log(`profiling ${fullLabel}`);
		// 			const profiler = this;
		// 			o[key] = function(this: any, ...args: any[])
		// 			{
		// 				// tslint:disable-next-line:no-string-literal
		// 				return profiler["trace"](value, this, args, fullLabel);
		// 			};
		// 			this.onCleanup.push(() =>
		// 			{
		// 				console.log(`unprofiling ${fullLabel}`);
		// 				o[key] = value;
		// 			});
		// 		}
		// 		if (_.isObject(value))
		// 		{
		// 			this.profileInstance(value, fullLabel);
		// 		}
		// 	}
		// 	else
		// 		console.log(`ignoring ${label}.${key}`);
		// }

		// const proto = o.__proto__;

		// console.log(`profiling ${label}, ${o.constructor.name}`);

		// const { proxy, revoke } = Proxy.revocable(proto, new PrototypeProxyHandler(this, label));
		// o.__proto__ = proxy;

		// console.log(`profiled ${label}, constructor now is ${o.constructor.name}`);

		// this.onCleanup.push(() =>
		// {
		// 	o.__proto__ = proto;
		// 	revoke();
		// });
	}
}
