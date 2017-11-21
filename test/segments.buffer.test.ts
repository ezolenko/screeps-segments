//import { tracker } from '../src/runtime.tracker';
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
	}

	public afterTick()
	{
		this.buffer.visualize(3);

		super.afterTick();
	}

	// tslint:disable:no-string-literal
	public run(): boolean
	{
		this.buffer.beforeTick();

		const id = 13;

		let onAfterTick: (() => void) | undefined;

		const res = this.runSequence(5,
		[
			// cleanup
			(iteration) =>
			{
				if (iteration === 0)
				{
					logger.error(`cleanup`);
					this.buffer.forgetAll();
				}
				return true;
			},
			// first set
			(iteration) =>
			{
				return this.delayFinish(1, () =>
				{
					const data = `${id}${iteration}`;

					this.buffer.set(id, data);

					this.assertEqual(this.buffer["cache"][id].d, data);
					this.assertEqual(this.buffer["cache"][id].version, 0);
					this.assertEqual(this.buffer["cache"][id].metadata.lastRead, -1);
					this.assertEqual(this.buffer["memory"].metadata[id], this.buffer["cache"][id].metadata);
					this.assertEqual(this.buffer["memory"].version, this.buffer["version"]);

					onAfterTick = () =>
					{
						const buffer = this.buffer["memory"].buffer[id];
						this.assertEqual(buffer, undefined);
					};

					return true;
				});
			},
			(iteration) =>
			{
				//const nodeSwitched = tracker.switchedNodes;

				const data = `${id}${iteration}`;

				const segment = this.buffer.get(id);

				this.assertNotEqual(segment.status, eSegmentBufferStatus.Empty);

				if (segment.status !== eSegmentBufferStatus.Ready)
				{
					this.assertEqual(segment.status, eSegmentBufferStatus.NextTick);
					return false;
				}

				this.assertEqual(segment.status, eSegmentBufferStatus.Ready);
				this.assertEqual(segment.data, data);

				const cache = this.buffer["cache"][id];
				this.assertNotEqual(cache, undefined);

				if (cache !== undefined)
				{
					this.assertEqual(cache.d, data);
					this.assertEqual(cache.version, 0);
					this.assertEqual(cache.metadata.cacheMiss, 2);
					this.assertEqual(cache.metadata.getCount, 2);
					this.assertEqual(cache.metadata.lastRead, Game.time);
					this.assertEqual(cache.metadata.lastReadRequest, Game.time - 1);
					this.assertEqual(cache.metadata.lastWrite, Game.time - 2);
					this.assertEqual(cache.metadata.lastWriteRequest, -1);
					this.assertEqual(cache.metadata.locked, undefined);
					this.assertEqual(cache.metadata.lockedCount, 0);
					this.assertEqual(cache.metadata.readCount, 1);
					this.assertEqual(cache.metadata.readRequestCount, 1);
					this.assertEqual(cache.metadata.savedVersion, 0);
					this.assertEqual(cache.metadata.setCount, 1);
					this.assertEqual(cache.metadata.writeCount, 1);
					this.assertEqual(cache.metadata.writeRequestCount, 0);
				}

				return true;
			},
		]);

		this.buffer.afterTick();

		if (onAfterTick !== undefined)
			onAfterTick();

		return res;
	}
}
