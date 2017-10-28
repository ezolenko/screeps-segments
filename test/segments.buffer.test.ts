import { TestDefinition } from "../harness/runner";
import { ScreepsTest } from "../harness/test";

export interface ISegmentsBufferTestMemory
{

}

@TestDefinition(0)
export class SegmentsBufferTest extends ScreepsTest<ISegmentsBufferTestMemory>
{
	public run(): boolean
	{
		return true;
	}
}
