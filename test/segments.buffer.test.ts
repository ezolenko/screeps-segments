//import { tracker } from '../src/runtime.tracker';
import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { SegmentBuffer, eSegmentBufferStatus } from "../lib/lib";
import { logger } from "../harness/logger";

export interface ISegmentsBufferTestMemory
{
	lastCacheInitTick: number;
}

@TestDefinition(0)
export class SegmentsBufferTest extends ScreepsTest<ISegmentsBufferTestMemory>
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

		const res = this.runSequence(2,
		[
			// cleanup
			(iteration) =>
			{
				if (iteration === 0)
				{
					logger.error(`cleanup`);
					this.buffer.forgetAll();

					this.assertEqual(this.buffer["cache"].initTick, Game.time);

					this.memory.lastCacheInitTick = Game.time;
				}
				return true;
			},
			// first set
			(iteration) =>
			{
				return this.delayFinish(1, () =>
				{
					const data = `${id}${iteration}`;

					logger.error(`${Game.time} setting data to '${data}'`);

					this.buffer.set(id, data);

					this.assertEqual(this.buffer["cache"].c[id].d, data);
					this.assertEqual(this.buffer["cache"].c[id].version, iteration);
					this.assertEqual(this.buffer["cache"].c[id].metadata.lastRead, -1);
					this.assertEqual(this.buffer["memory"].metadata[id], this.buffer["cache"].c[id].metadata);
					this.assertEqual(this.buffer["memory"].metadata[id].setCount, 1);
					this.assertEqual(this.buffer["memory"].version, this.buffer["version"]);
					this.assertEqual(this.buffer["cache"].initTick, this.memory.lastCacheInitTick);

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

				this.assertEqual(this.buffer["cache"].initTick, this.memory.lastCacheInitTick);

				this.assertNotEqual(segment.status, eSegmentBufferStatus.Empty);

				if (segment.status !== eSegmentBufferStatus.Ready)
				{
					this.assertEqual(segment.status, eSegmentBufferStatus.NextTick);
					return false;
				}

				this.assertEqual(segment.status, eSegmentBufferStatus.Ready);
				this.assertEqual(segment.data, data);

				const cache = this.buffer["cache"].c[id];
				this.assertNotEqual(cache, undefined);

				logger.error(`${Game.time} getting data '${cache.d}'`);

				if (cache !== undefined)
				{
					this.assertEqual(cache.d, data);
					this.assertEqual(cache.version, iteration);
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
					this.assertEqual(cache.metadata.savedVersion, iteration);
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
