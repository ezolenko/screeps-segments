import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { segmentStorage, SegmentStringStorage } from "../src/segments.storage";
import { eSegmentBufferStatus } from "../src/segments.buffer";

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
		const original = this.generateData(0, 13, 2.5 * 500 * 1024);
		return this.runSequence(10,
		[
			() =>
			{
				segmentStorage.setString(label, original);

				const { status, data } = segmentStorage.getString(label);

				this.assertEqual(status, eSegmentBufferStatus.Ready);
				this.assertEqual(data, original);

				return true;
			},
			() =>
			{
				const { status, data } = segmentStorage.getString(label);

				if (status === eSegmentBufferStatus.NextTick || status === eSegmentBufferStatus.Delayed)
					return false;

				this.assertEqual(status, eSegmentBufferStatus.Ready);
				this.assertEqual(data, original);

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
			() => this.runSetGet(out),
		]);

		segmentStorage.afterTick();

		if (out.onAfterTick !== undefined)
			out.onAfterTick();

		return res;
	}
}
