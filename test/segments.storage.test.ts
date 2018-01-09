import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";
import { segmentStorage, SegmentStringStorage } from "../src/segments.storage";
import { eSegmentBufferStatus, segmentBuffer } from "../src/segments.buffer";

@TestDefinition(2)
export class SegmentsStorageTest extends ScreepsTest<{}>
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

	// tslint:disable:no-string-literal
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

					this.assertEqual(segmentStorage["cache"].c[label].data, original);
					this.assertEqual(segmentStorage["cache"].c[label].v, iteration);
					this.assertEqual(segmentStorage["cache"].c[label].metadata.v, iteration - 1);
					this.assertEqual(segmentStorage["memory"].m[label].v, iteration - 1);

					const { status, data } = segmentStorage.getString(label);

					this.assertEqual(status, eSegmentBufferStatus.Ready);
					this.assertEqual(data, original);

					return true;
				});
			},
			(iteration) =>
			{
				const original = this.generateData(iteration, 13, 2.5 * segmentBuffer.maxSize);

				this.assertEqual(segmentBuffer.getUsedSegments().length, 3);

				this.assertEqual(segmentStorage["memory"].m[label].v, iteration);

				const { status, data } = segmentStorage.getString(label);

				if (status === eSegmentBufferStatus.NextTick || status === eSegmentBufferStatus.Delayed)
					return false;

				this.assertEqual(segmentStorage["cache"].c[label].data, original);
				this.assertEqual(segmentStorage["cache"].c[label].v, iteration);
				this.assertEqual(segmentStorage["cache"].c[label].metadata.v, iteration);

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
