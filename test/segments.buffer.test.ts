import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { SegmentBuffer, eSegmentBufferStatus } from "../src/segments.buffer";
import { logger } from "../harness/logger";

// export interface ISegmentsBufferTestMemory
// {
// }

@TestDefinition(0)
export class SegmentsBufferTest extends ScreepsTest<{}>
{
	private buffer = new SegmentBuffer(logger);

	public beforeTick()
	{
		super.beforeTick();

		this.profileObject(this.buffer, SegmentBuffer.name);

		this.buffer.beforeTick();
	}

	public afterTick()
	{
		this.buffer.afterTick();

		super.afterTick();
	}

	public run(): boolean
	{
		return this.runSequence(3,
		[
			() => this.oneTickAssingment(),
		]);
	}

	private oneTickAssingment(): boolean
	{
		const data = "13";
		return this.runSequence(2,
		[
			(iteration) => { logger.error(`oneTickAssingment iteration: ${iteration}`); return true; },
			() =>
			{
				this.buffer.set(13, data);
				return true;
			},
			() =>
			{
				const segment = this.buffer.get(13);
				this.assert(segment.status === eSegmentBufferStatus.Ready);
				this.assert(segment.data !== data);
				this.assert(false, "with comment");
				return true;
			},
		]);
	}
}
