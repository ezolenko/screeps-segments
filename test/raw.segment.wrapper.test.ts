import { Logger } from "./logger";
import { RawSegmentWrapper } from "../src/segments";

const logger = new Logger();
const wrapper = new RawSegmentWrapper(logger);

function generateData(version: number, id: number, size: number = wrapper.maxMemory)
{
	const prefix = `${version} ${id}`;
	return prefix + _.repeat("+", size - prefix.length);
}

function fillAllSegments(): boolean
{
	let id = Memory.__test.raw.start || 0;
	for (id = 0; id < wrapper.maxSegments; ++id)
	{
		const data = generateData(1, id);
		if (!wrapper.saveSegment(id, data))
		{
			Memory.__test.raw.start = id + 1;
			break;
		}
	}

	return id >= wrapper.maxSegments;
}

export function run()
{
	wrapper.beforeTick();

	fillAllSegments();

	wrapper.visualize(1, 1);
	wrapper.afterTick();
}

export function reset()
{
	delete Memory.__test.raw.start;
}
