import { SegmentsBasicWrapper } from "../src/segments.basic.wrapper";
import { logger } from "../harness/logger";
import { ScreepsTest } from "../harness/test";
import { TestDefinition } from "../harness/runner";

export interface ISegmentsBasicWrapperTestMemory
{
	start?: number;
	clearStart?: number;
	checked?: { [id: number]: boolean };
}

@TestDefinition(0)
export class SegmentsBasicWrapperTest extends ScreepsTest<ISegmentsBasicWrapperTestMemory>
{
	private static wrapper = new SegmentsBasicWrapper(logger);

	public beforeTick()
	{
		super.beforeTick();

		this.profileObject(SegmentsBasicWrapperTest.wrapper, "RawSegmentWrapper");

		SegmentsBasicWrapperTest.wrapper.beforeTick();
	}

	public afterTick()
	{
		SegmentsBasicWrapperTest.wrapper.visualize(1, 1, 2);
		SegmentsBasicWrapperTest.wrapper.afterTick();

		super.afterTick();
	}

	public run(): boolean
	{
		return this.runSequence(2,
		[
			(iteration) => { logger.error(`iteration: ${iteration}`); return true; },
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
		for (; id < SegmentsBasicWrapperTest.wrapper.maxSegments; ++id)
		{
			const data = this.generateData(1, id);
			if (!SegmentsBasicWrapperTest.wrapper.saveSegment(id, data))
			{
				this.memory.start = id;
				break;
			}
			ids.push(id);
		}

		if (id >= SegmentsBasicWrapperTest.wrapper.maxSegments)
			this.memory.start = id;

		if (ids.length > 0)
			logger.error(`filling: ${ids.join(", ")}`);

		return id >= SegmentsBasicWrapperTest.wrapper.maxSegments;
	}

	private checkSegments(): boolean
	{
		if (this.memory.checked === undefined)
		this.memory.checked = {};

		logger.error(`checking`);
		for (let id = 0; id < SegmentsBasicWrapperTest.wrapper.maxSegments; ++id)
		{
			if (this.memory.checked[id])
				continue;

			const data = SegmentsBasicWrapperTest.wrapper.getSegment(id);
			if (data === undefined)
			{
				SegmentsBasicWrapperTest.wrapper.requestSegment(id);
				this.memory.checked[id] = false;
			}
			else
			{
				if (!data.startsWith(`${id}:`) || data.length !== SegmentsBasicWrapperTest.wrapper.maxMemory)
					logger.error(`${id}: bad data: ${data.slice(0, 10)}, length: ${data.length}`);

				this.memory.checked[id] = true;
			}
		}

		return _.all(this.memory.checked);
	}

	private clearAllSegments(): boolean
	{
		let id = this.memory.clearStart || 0;

		const ids: number[] = [];
		for (; id < SegmentsBasicWrapperTest.wrapper.maxSegments; ++id)
		{
			const data = "";
			if (!SegmentsBasicWrapperTest.wrapper.saveSegment(id, data))
			{
				this.memory.clearStart = id;
				break;
			}
			ids.push(id);
		}

		if (id >= SegmentsBasicWrapperTest.wrapper.maxSegments)
			this.memory.clearStart = id;

		if (ids.length > 0)
			logger.error(`clearing: ${ids.join(", ")}`);

		return id >= SegmentsBasicWrapperTest.wrapper.maxSegments;
	}

	private generateData(version: number, id: number, size: number = SegmentsBasicWrapperTest.wrapper.maxMemory)
	{
		const prefix = `${id}: ${version}`;
		return prefix + _.repeat("+", size - prefix.length);
	}
}
