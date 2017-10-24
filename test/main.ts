import { Logger } from "./logger";
import { SegmentBuffer } from "../src/segments";

const logger = new Logger();
const segments = new SegmentBuffer(logger);

function beforeTick()
{
	segments.beforeTick();
}

function tick()
{
	//
}

function afterTick()
{
	segments.afterTick();
}

export function loop()
{
	beforeTick();

	tick();

	afterTick();
}
