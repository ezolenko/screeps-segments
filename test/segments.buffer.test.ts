//import { tracker } from '../src/runtime.tracker';
import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { SegmentBuffer, eSegmentBufferStatus } from "../lib/lib";
import { logger } from "../harness/logger";

export interface ISegmentsBufferTestMemory
{
	lastCacheInitTick: number;
	load:
	{
		usedSegments: number[];
		readSegments: { [id: number]: 1 | undefined };
	};
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
	private runSetGet(out: { onAfterTick?: (() => void) | undefined }): boolean
	{
		const id = 13;

		return this.runSequence(5,
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
					this.assertEqual(this.buffer["cache"].c[id].metadata.lastRead, iteration === 0 ? -1 : Game.time);
					this.assertEqual(this.buffer["memory"].metadata[id], this.buffer["cache"].c[id].metadata);
					this.assertEqual(this.buffer["memory"].metadata[id].setCount, iteration + 1);
					this.assertEqual(this.buffer["memory"].version, this.buffer["version"]);
					this.assertEqual(this.buffer["cache"].initTick, this.memory.lastCacheInitTick);

					out.onAfterTick = () =>
					{
						const buffer = this.buffer["memory"].buffer[id];
						if (iteration === 0)
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
					this.assertEqual(cache.metadata.cacheMiss, 2 * (iteration + 1));
					this.assertEqual(cache.metadata.getCount, 2 * (iteration + 1));
					this.assertEqual(cache.metadata.lastRead, Game.time);
					this.assertEqual(cache.metadata.lastReadRequest, Game.time - 1);
					this.assertEqual(cache.metadata.lastWrite, Game.time - 2);
					this.assertEqual(cache.metadata.lastWriteRequest, -1);
					this.assertEqual(cache.metadata.locked, undefined);
					this.assertEqual(cache.metadata.lockedCount, 0);
					this.assertEqual(cache.metadata.readCount, iteration + 1);
					this.assertEqual(cache.metadata.readRequestCount, iteration + 1);
					this.assertEqual(cache.metadata.savedVersion, iteration);
					this.assertEqual(cache.metadata.setCount, iteration + 1);
					this.assertEqual(cache.metadata.writeCount, iteration + 1);
					this.assertEqual(cache.metadata.writeRequestCount, 0);
				}

				return true;
			},
		]);
	}

	private runSetGetClear(out: { onAfterTick?: (() => void) | undefined }): boolean
	{
		const id = 14;

		return this.runSequence(1,
		[
			// cleanup
			(iteration) =>
			{
				if (iteration === 0)
				{
					logger.error(`cleanup`);
					this.buffer.forgetAll();
					this.memory.lastCacheInitTick = Game.time;
				}
				return true;
			},
			(iteration) =>
			{
				return this.delayFinish(1, () =>
				{
					const data = `${id}${iteration}`;

					logger.error(`${Game.time} setting data to '${data}'`);

					this.buffer.set(id, data);

					const result = this.buffer.get(id);
					this.assertEqual(result.status, eSegmentBufferStatus.Ready);
					this.assertEqual(result.data, data);

					out.onAfterTick = () =>
					{
						const buffer = this.buffer["memory"].buffer[id];
						if (iteration === 0)
							this.assertEqual(buffer, undefined);
					};

					return true;
				});
			},
			() =>
			{
				return this.delayFinish(1, () =>
				{
					this.buffer.clear(id);

					const cache = this.buffer["cache"].c[id];
					this.assertEqual(cache, undefined);

					const result = this.buffer.get(id);
					this.assertEqual(result.status, eSegmentBufferStatus.Empty);

					return true;
				});
			},
			() =>
			{
				return this.runSequence(10,
				[
					() =>
					{
						return this.delayFinish(1, () =>
						{
							const cache = this.buffer["cache"].c[id];
							this.assertEqual(cache, undefined);

							const result = this.buffer.get(id);
							this.assertEqual(result.status, eSegmentBufferStatus.Empty);

							return true;
						});
					},
				]);
			},
		]);
	}

	private loadTesting(_out: { onAfterTick?: (() => void) | undefined }): boolean
	{
		const loadFactor = 30;
		return this.runSequence(10,
		[
			() =>
			{
				return this.delayFinish(3, () =>
				{
					// 30 random segments
					this.memory.load.usedSegments = _.shuffle(_.range(0, 99, 1)).slice(0, loadFactor);
					this.memory.load.readSegments = {};

					this.memory.load.usedSegments.forEach((id) =>
					{
						const data = `${id}data`;
						this.buffer.set(id, data);
					});

					this.memory.load.usedSegments.forEach((id) =>
					{
						const expectedData = `${id}data`;

						const result = this.buffer.get(id);

						this.assertEqual(result.status, eSegmentBufferStatus.Ready);
						this.assertEqual(result.data, expectedData);
					});

					return true;
				});
			},
			() =>
			{
				this.memory.load.usedSegments.forEach((id) =>
				{
					const expectedData = `${id}data`;

					const result = this.buffer.get(id);

					if (result.status === eSegmentBufferStatus.Ready)
					{
						this.assertEqual(result.data, expectedData);
						this.memory.load.readSegments[id] = 1;
					}

					this.assertNotEqual(result.status, eSegmentBufferStatus.Empty);
				});

				return _.sum(this.memory.load.readSegments) === loadFactor;
			},
		]);
	}

	public run(): boolean
	{
		this.buffer.beforeTick();

		const out: { onAfterTick?: (() => void) } = {};

		const res = this.runSequence(1,
		[
			() => this.runSetGet(out),
			() => this.runSetGetClear(out),
			() => this.loadTesting(out),
		]);

		this.buffer.afterTick();

		if (out.onAfterTick !== undefined)
			out.onAfterTick();

		return res;
	}
}
