import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { SegmentBuffer, eSegmentBufferStatus, segmentBuffer } from "../lib/lib";
import { log } from "../src/ilogger";

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
	public reset()
	{
		segmentBuffer.reset();
	}

	public beforeTick()
	{
		super.beforeTick();

		this.profileInstance(segmentBuffer, SegmentBuffer.name);
	}

	public afterTick()
	{
		segmentBuffer.visualize(3);

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
					log.error(`cleanup`);
					segmentBuffer.forgetAll();

					this.assertEqual(segmentBuffer["cache"].initTick, Game.time);

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

					log.error(`${Game.time} setting data to '${data}'`);

					segmentBuffer.set(id, data);

					this.assertEqual(segmentBuffer["cache"].c[id].d, data);
					this.assertEqual(segmentBuffer["cache"].c[id].version, iteration);
					this.assertEqual(segmentBuffer["cache"].c[id].metadata.lastRead, iteration === 0 ? -1 : Game.time);
					this.assertEqual(segmentBuffer["memory"].metadata[id], segmentBuffer["cache"].c[id].metadata);
					this.assertEqual(segmentBuffer["memory"].metadata[id].setCount, iteration + 1);
					this.assertEqual(segmentBuffer["memory"].version, segmentBuffer["version"]);
					this.assertEqual(segmentBuffer["cache"].initTick, this.memory.lastCacheInitTick);

					out.onAfterTick = () =>
					{
						const buffer = segmentBuffer["memory"].buffer[id];
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

				const segment = segmentBuffer.get(id);

				this.assertEqual(segmentBuffer["cache"].initTick, this.memory.lastCacheInitTick);

				this.assertNotEqual(segment.status, eSegmentBufferStatus.Empty);

				if (segment.status !== eSegmentBufferStatus.Ready)
				{
					this.assertEqual(segment.status, eSegmentBufferStatus.NextTick);
					return false;
				}

				this.assertEqual(segment.status, eSegmentBufferStatus.Ready);
				this.assertEqual(segment.data, data);

				const cache = segmentBuffer["cache"].c[id];
				this.assertNotEqual(cache, undefined);

				log.error(`${Game.time} getting data '${cache.d}'`);

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
					log.error(`cleanup`);
					segmentBuffer.forgetAll();
					this.memory.lastCacheInitTick = Game.time;
				}
				return true;
			},
			(iteration) =>
			{
				return this.delayFinish(1, () =>
				{
					const data = `${id}${iteration}`;

					log.error(`${Game.time} setting data to '${data}'`);

					segmentBuffer.set(id, data);

					this.assertEqual(segmentBuffer["cache"].c[id].d, data);
					this.assertEqual(segmentBuffer["cache"].c[id].version, iteration);
					this.assertEqual(segmentBuffer["cache"].c[id].metadata.lastRead, iteration === 0 ? -1 : Game.time);
					this.assertEqual(segmentBuffer["memory"].metadata[id], segmentBuffer["cache"].c[id].metadata);
					this.assertEqual(segmentBuffer["memory"].metadata[id].setCount, iteration + 1);
					this.assertEqual(segmentBuffer["memory"].metadata[id].savedVersion, iteration - 1);
					this.assertEqual(segmentBuffer["memory"].version, segmentBuffer["version"]);
					this.assertEqual(segmentBuffer["cache"].initTick, this.memory.lastCacheInitTick);

					const result = segmentBuffer.get(id);
					this.assertEqual(result.status, eSegmentBufferStatus.Ready);
					this.assertEqual(result.data, data);

					out.onAfterTick = () =>
					{
						const buffer = segmentBuffer["memory"].buffer[id];
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
					segmentBuffer.clear(id);

					const cache = segmentBuffer["cache"].c[id];
					this.assertEqual(cache, undefined);

					const result = segmentBuffer.get(id);
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
							const cache = segmentBuffer["cache"].c[id];
							this.assertEqual(cache, undefined);

							const result = segmentBuffer.get(id);
							this.assertEqual(result.status, eSegmentBufferStatus.Empty);

							return true;
						});
					},
				]);
			},
		]);
	}

	private generateData(version: number, id: number, size: number)
	{
		const prefix = `${id}: ${version}`;
		return prefix + _.repeat("+", size - prefix.length);
	}

	private loadTesting(_out: { onAfterTick?: (() => void) | undefined }): boolean
	{
		if (this.memory.load === undefined)
			this.memory.load = { usedSegments: [], readSegments: {} };
		const loadFactor = 30;
		const size = 1024 * 20;
		return this.runSequence(2,
		[
			// cleanup
			(iteration) =>
			{
				if (iteration === 0)
				{
					log.error(`cleanup`);
					segmentBuffer.forgetAll();

					this.assertEqual(segmentBuffer["cache"].initTick, Game.time);

					this.memory.lastCacheInitTick = Game.time;
				}
				return true;
			},
			() =>
			{
				return this.delayFinish(3, () =>
				{
					log.error(`writing ${loadFactor} segments`);
					// 30 random segments
					this.memory.load.usedSegments = _.shuffle(_.range(0, 99)).slice(0, loadFactor);
					this.memory.load.readSegments = {};

					this.memory.load.usedSegments.forEach((id) =>
					{
						const data = this.generateData(0, id, size);
						segmentBuffer.set(id, data);
					});

					this.memory.load.usedSegments.forEach((id) =>
					{
						const expectedData = this.generateData(0, id, size);

						const result = segmentBuffer.get(id);

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
					const expectedData = this.generateData(0, id, size);

					const result = segmentBuffer.get(id);

					log.error(`reading ${id}, status: ${result.status}`);

					if (result.status === eSegmentBufferStatus.Ready)
					{
						this.assertEqual(result.data, expectedData);
						this.memory.load.readSegments[id] = 1;
					}

					this.assertNotEqual(result.status, eSegmentBufferStatus.Empty);
				});

				log.error(`reading ${loadFactor} segments, read so far: ${_.sum(this.memory.load.readSegments)}`);

				return _.sum(this.memory.load.readSegments) === loadFactor;
			},
			() => this.delayFinish(10, () => true),
			() =>
			{
				this.memory.load.usedSegments.forEach((id) =>
				{
					this.assertEqual(segmentBuffer["memory"].buffer[id], undefined);
				});

				return true;
			},
		]);
	}

	public run(): boolean
	{
		segmentBuffer.beforeTick();

		const out: { onAfterTick?: (() => void) } = {};

		const res = this.runSequence(1,
		[
			() => this.loadTesting(out),
			() => this.runSetGet(out),
			() => this.runSetGetClear(out),
		]);

		segmentBuffer.afterTick();

		if (out.onAfterTick !== undefined)
			out.onAfterTick();

		return res;
	}
}
