import { Logger } from "./logger";
import { RawSegmentWrapper } from "../src/segments";

const logger = new Logger();
const wrapper = new RawSegmentWrapper(logger);

function generateData(version: number, id: number, size: number = wrapper.maxMemory)
{
	const prefix = `${id}: ${version}`;
	return prefix + _.repeat("+", size - prefix.length);
}

function fillAllSegments(): boolean
{
	let id = Memory.__test.raw.start || 0;
	for (; id < wrapper.maxSegments; ++id)
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

function checkSegments(): boolean
{
	if (Memory.__test.raw.checked === undefined)
		Memory.__test.raw.checked = {};

	for (let id = 0; id < wrapper.maxSegments; ++id)
	{
		if (Memory.__test.raw.checked[id])
			continue;

		const data = wrapper.getSegment(id);
		if (data === undefined)
			wrapper.requestSegment(id);
		else
			Memory.__test.raw.checked[id] = data.startsWith(`${id}:`) && data.length === wrapper.maxMemory;
	}

	return _.all(Memory.__test.raw.checked);
}

export function run()
{
	wrapper.beforeTick();

	if (fillAllSegments())
		checkSegments();

	wrapper.visualize(1, 1);
	wrapper.afterTick();
}

export function reset()
{
	delete Memory.__test.raw.start;
}
