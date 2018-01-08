import { segmentWrapper, SegmentsBasicWrapper } from "../lib/lib";
import { ScreepsTest } from "../harness/test";
import { TestDefinition } from "../harness/runner";
import { SourceMapWrapper } from "../harness/sourcemap";
import { log } from "../src/ilogger";

export interface ISegmentsBasicWrapperTestMemory
{
	start?: number;
	clearStart?: number;
	checked?: { [id: number]: boolean };
}

@TestDefinition(1)
export class SegmentsBasicWrapperTest extends ScreepsTest<ISegmentsBasicWrapperTestMemory>
{
	constructor(sourceMap: SourceMapWrapper)
	{
		super(sourceMap);
	}

	public beforeTick()
	{
		super.beforeTick();

		this.profileInstance(segmentWrapper, SegmentsBasicWrapper.name);

		segmentWrapper.beforeTick();
	}

	public afterTick()
	{
		segmentWrapper.visualize(3);
		segmentWrapper.afterTick();

		super.afterTick();
	}

	public run(): boolean
	{
		return this.runSequence(1,
		[
			(iteration) => { log.error(`iteration: ${iteration}`); return true; },
			() => this.fillAllSegments(),
			() => this.checkSegments(),
			() => this.clearAllSegments(),
			() => this.restart(),
		]);
	}

	private restart()
	{
		delete this.memory.start;
		delete this.memory.clearStart;
		delete this.memory.checked;
		return true;
	}

	private fillAllSegments(): boolean
	{
		let id = this.memory.start || 0;

		const ids: number[] = [];
		for (; id < segmentWrapper.maxSegments; ++id)
		{
			const data = this.generateData(1, id);
			if (!segmentWrapper.saveSegment(id, data))
			{
				this.memory.start = id;
				break;
			}
			ids.push(id);
		}

		if (id >= segmentWrapper.maxSegments)
			this.memory.start = id;

		if (ids.length > 0)
			log.error(`filling: ${ids.join(", ")}`);

		return id >= segmentWrapper.maxSegments;
	}

	private checkSegments(): boolean
	{
		if (this.memory.checked === undefined)
		this.memory.checked = {};

		log.error(`checking`);
		for (let id = 0; id < segmentWrapper.maxSegments; ++id)
		{
			if (this.memory.checked[id])
				continue;

			const data = segmentWrapper.getSegment(id);
			if (data === undefined)
			{
				segmentWrapper.requestSegment(id);
				this.memory.checked[id] = false;
			}
			else
			{
				if (!data.startsWith(`${id}:`) || data.length !== segmentWrapper.maxMemory)
					log.error(`${id}: bad data: ${data.slice(0, 10)}, length: ${data.length}`);

				this.memory.checked[id] = true;
			}
		}

		return _.all(this.memory.checked);
	}

	private clearAllSegments(): boolean
	{
		let id = this.memory.clearStart || 0;

		const ids: number[] = [];
		for (; id < segmentWrapper.maxSegments; ++id)
		{
			const data = "";
			if (!segmentWrapper.saveSegment(id, data))
			{
				this.memory.clearStart = id;
				break;
			}
			ids.push(id);
		}

		if (id >= segmentWrapper.maxSegments)
			this.memory.clearStart = id;

		if (ids.length > 0)
			log.error(`clearing: ${ids.join(", ")}`);

		return id >= segmentWrapper.maxSegments;
	}

	private generateData(version: number, id: number, size: number = segmentWrapper.maxMemory)
	{
		const prefix = `${id}: ${version}`;
		return prefix + _.repeat("+", size - prefix.length);
	}
}
