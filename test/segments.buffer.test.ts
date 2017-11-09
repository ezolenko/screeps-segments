import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { SegmentBuffer, eSegmentBufferStatus } from "../lib/lib";
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

		this.profileInstance(this.buffer, SegmentBuffer.name);

		this.buffer.beforeTick();
	}

	public afterTick()
	{
		this.buffer.visualize(3);
		this.buffer.afterTick();

		super.afterTick();
	}

	public run(): boolean
	{
		return this.runSequence(3,
		[
			() => this.oneTickAssignment(),
		]);
	}

	private oneTickAssignment(): boolean
	{
		return this.runSequence(10,
		[
			(iteration) =>
			{
				logger.error(`oneTickAssignment iteration: ${iteration}`);

				const id = 13;
				const data = `${id}${iteration}`;

				this.buffer.set(id, data);
				const segment = this.buffer.get(id);

				this.assert(segment.status === eSegmentBufferStatus.Ready);
				this.assert(segment.data === data);

				// tslint:disable:no-string-literal
				this.assert(this.buffer["cache"][id].d === data);
				this.assert(this.buffer["cache"][id].version === iteration);
				this.assert(this.buffer["cache"][id].metadata.cacheMiss === 0);
				this.assert(this.buffer["cache"][id].metadata.getCount === iteration + 1);
				this.assert(this.buffer["cache"][id].metadata.lastRead === Game.time);
				this.assert(this.buffer["cache"][id].metadata.lastReadRequest === Game.time);
				this.assert(this.buffer["cache"][id].metadata.lastWrite === Game.time);
				this.assert(this.buffer["cache"][id].metadata.lastWriteRequest === Game.time);
				this.assert(this.buffer["cache"][id].metadata.locked === undefined);
				this.assert(this.buffer["cache"][id].metadata.lockedCount === 0);
				this.assert(this.buffer["cache"][id].metadata.readCount === iteration + 1);
				this.assert(this.buffer["cache"][id].metadata.readRequestCount === iteration + 1);
				this.assert(this.buffer["cache"][id].metadata.savedVersion === iteration);
				this.assert(this.buffer["cache"][id].metadata.setCount === iteration + 1);
				this.assert(this.buffer["cache"][id].metadata.writeCount === iteration + 1);
				this.assert(this.buffer["cache"][id].metadata.writeRequestCount === iteration + 1);

				this.assert(this.buffer["memory"].version === this.buffer["version"]);
				this.assert(this.buffer["memory"].metadata[id] === this.buffer["cache"][id].metadata);

				const buffer = this.buffer["memory"].buffer[id];
				this.assert(buffer !== undefined);
				if (buffer !== undefined)
				{
					this.assert(buffer.version === iteration);
				}

				return true;
			},
		]);
	}
}
