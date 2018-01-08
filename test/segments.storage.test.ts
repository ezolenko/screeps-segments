import { logger } from "../harness/logger";
import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { SegmentStringStorage } from "../src/segments.storage";
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
	private storage = new SegmentStringStorage(logger);

	public beforeTick()
	{
		super.beforeTick();

		this.profileInstance(this.storage, SegmentStringStorage.name);
	}

	public afterTick()
	{
		this.storage.visualize(3);

		super.afterTick();
	}

	public runSetGet(_out: { onAfterTick?: (() => void) | undefined }): boolean
	{
		const label = "label1";
		const original = this.generateData(0, 13, 2.5 * 500 * 1024);
		return this.runSequence(1,
		[
			() =>
			{
				this.storage.setString(label, original);
				return true;
			},
			() =>
			{
				const { status, data } = this.storage.getString(label);

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
		this.storage.beforeTick();

		const out: { onAfterTick?: (() => void) } = {};

		const res = this.runSequence(1,
		[
			() => this.runSetGet(out),
		]);

		this.storage.afterTick();

		if (out.onAfterTick !== undefined)
			out.onAfterTick();

		return res;
	}
}
