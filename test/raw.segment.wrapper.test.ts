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

	const ids: number[] = [];
	for (; id < wrapper.maxSegments; ++id)
	{
		const data = generateData(1, id);
		if (!wrapper.saveSegment(id, data))
		{
			Memory.__test.raw.start = id;
			break;
		}
		ids.push(id);
	}

	if (id >= wrapper.maxSegments)
		Memory.__test.raw.start = id;

	logger.error(`filling: ${ids.join(", ")}`);

	return id >= wrapper.maxSegments;
}

function clearAllSegments(): boolean
{
	let id = Memory.__test.raw.clearStart || 0;

	const ids: number[] = [];
	for (; id < wrapper.maxSegments; ++id)
	{
		const data = "";
		if (!wrapper.saveSegment(id, data))
		{
			Memory.__test.raw.clearStart = id;
			break;
		}
		ids.push(id);
	}

	if (id >= wrapper.maxSegments)
		Memory.__test.raw.clearStart = id;

	logger.error(`clearing: ${ids.join(", ")}`);

	return id >= wrapper.maxSegments;
}

function checkSegments(): boolean
{
	logger.error(`checking`);

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
		{
			if (!data.startsWith(`${id}:`) || data.length === wrapper.maxMemory)
				logger.error(`${id}: bad data: ${data}`);

			Memory.__test.raw.checked[id] = true;
		}
	}

	return _.all(Memory.__test.raw.checked, (e) => e === true);
}

export function run()
{
	_.defaultsDeep(Memory, { __test: { raw: {} } });

	wrapper.beforeTick();

	if (fillAllSegments())
		if (checkSegments())
			if (clearAllSegments())
				reset();

	wrapper.visualize(1, 1, 2);
	wrapper.afterTick();
}

export function reset()
{
	delete Memory.__test.raw.start;
	delete Memory.__test.raw.checked;
	delete Memory.__test.raw.clearStart;
}
