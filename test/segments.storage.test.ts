import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { segmentStorage, SegmentStringStorage } from "../src/segments.storage";
import { eSegmentBufferStatus, segmentBuffer } from "../src/segments.buffer";

export interface ISegmentsBufferTestMemory
{
	lastCacheInitTick: number;
	load:
	{
		usedSegments: number[];
		readSegments: { [id: number]: 1 | undefined };
	};
}

@TestDefinition(2)
export class SegmentsStorageTest extends ScreepsTest<ISegmentsBufferTestMemory>
{
	public beforeTick()
	{
		super.beforeTick();

		this.profileInstance(segmentStorage, SegmentStringStorage.name);
	}

	public afterTick()
	{
		segmentStorage.visualize(3);

		super.afterTick();
	}

	public runSetGet(_out: { onAfterTick?: (() => void) | undefined }): boolean
	{
		const label = "label1";
		return this.runSequence(1,
		[
			(iteration) =>
			{
				const original = this.generateData(iteration, 13, 2.5 * segmentBuffer.maxSize);
				return this.delayFinish(1, () =>
				{
					segmentStorage.setString(label, original);

					const { status, data } = segmentStorage.getString(label);

					this.assertEqual(status, eSegmentBufferStatus.Ready);
					this.assertEqual(data, original);

					return true;
				});
			},
			(iteration) =>
			{
				this.assertEqual(segmentBuffer.getUsedSegments().length, 3);

				const original = this.generateData(iteration, 13, 2.5 * segmentBuffer.maxSize);

				const { status, data } = segmentStorage.getString(label);

				if (status === eSegmentBufferStatus.NextTick || status === eSegmentBufferStatus.Delayed)
					return false;

				this.assertEqual(status, eSegmentBufferStatus.Ready);
				this.assertEqual(data, original);

				return true;
			},
			(_iteration) =>
			{
				this.assertEqual(segmentBuffer.getUsedSegments().length, 3);
				return true;
			},
		]);
	}

	private generateData(version: number, id: number, size: number)
	{
		const prefix = `${id}: ${version}`;
		return prefix + _.repeat("+", size - prefix.length);
	}

	public run(): boolean
	{
		segmentStorage.beforeTick();

		const out: { onAfterTick?: (() => void) } = {};

		const res = this.runSequence(1,
		[
			() =>
			{
				this.assertEqual(segmentBuffer.getUsedSegments().length, 0);
				return true;
			},
			() => this.runSetGet(out),
		]);

		segmentStorage.afterTick();

		if (out.onAfterTick !== undefined)
			out.onAfterTick();

		return res;
	}
}
