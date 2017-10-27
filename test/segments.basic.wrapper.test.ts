import { SegmentsBasicWrapper } from "../src/segments.basic.wrapper";
import { logger } from "../harness/logger";
import { ScreepsTest } from "../harness/test";
import { TestDefinition } from "../harness/runner";

const wrapper = new SegmentsBasicWrapper(logger);

function generateData(version: number, id: number, size: number = wrapper.maxMemory)
{
	const prefix = `${id}: ${version}`;
	return prefix + _.repeat("+", size - prefix.length);
}

export interface IOwnMemory
{
	start?: number;
	clearStart?: number;
	checked?: { [id: number]: boolean };
}

@TestDefinition(0)
export class RawSegmentWrapperTest extends ScreepsTest<IOwnMemory>
{
	public beforeTick()
	{
		super.beforeTick();

		this.profileObject(wrapper, "RawSegmentWrapper");

		wrapper.beforeTick();
	}

	public afterTick()
	{
		wrapper.visualize(1, 1, 2);
		wrapper.afterTick();

		super.afterTick();
	}

	public run(): boolean
	{
		return this.runSequence(5,
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
		for (; id < wrapper.maxSegments; ++id)
		{
			const data = generateData(1, id);
			if (!wrapper.saveSegment(id, data))
			{
				this.memory.start = id;
				break;
			}
			ids.push(id);
		}

		if (id >= wrapper.maxSegments)
			this.memory.start = id;

		if (ids.length > 0)
			logger.error(`filling: ${ids.join(", ")}`);

		return id >= wrapper.maxSegments;
	}

	private checkSegments(): boolean
	{
		if (this.memory.checked === undefined)
		this.memory.checked = {};

		logger.error(`checking`);
		for (let id = 0; id < wrapper.maxSegments; ++id)
		{
			if (this.memory.checked[id])
				continue;

			const data = wrapper.getSegment(id);
			if (data === undefined)
			{
				wrapper.requestSegment(id);
				this.memory.checked[id] = false;
			}
			else
			{
				if (!data.startsWith(`${id}:`) || data.length !== wrapper.maxMemory)
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
		for (; id < wrapper.maxSegments; ++id)
		{
			const data = "";
			if (!wrapper.saveSegment(id, data))
			{
				this.memory.clearStart = id;
				break;
			}
			ids.push(id);
		}

		if (id >= wrapper.maxSegments)
			this.memory.clearStart = id;

		if (ids.length > 0)
			logger.error(`clearing: ${ids.join(", ")}`);

		return id >= wrapper.maxSegments;
	}
}
