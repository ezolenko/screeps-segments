interface ISegmentMetadata
{
	cacheMiss: number;

	savedVersion: number;

	lastWrite: number;
	lastRead: number;
	lastReadRequest: number;
	lastWriteRequest: number;

	writeCount: number;
	readCount: number;
	readRequestCount: number;
	writeRequestCount: number;
	setCount: number;
	getCount: number;

	locked?: 1;
	lockedCount: number;
}

interface ISegmentsBufferEntry
{
	d: string;
	version: number;
	lastRead: number;
}

interface ISegmentBuffer
{
	version: number;
	metadata: { [id: string]: ISegmentMetadata };
	buffer: { [id: string]: ISegmentsBufferEntry };
}

interface ISegmentStorageMetadata
{
	sections: { [id: number]: { order: number,  }};
	order: number[];
	locked?: 1;
}

interface ISegmentStorageMemory
{
	metadata: { [label: string]: ISegmentStorageMetadata };
}

interface Memory
{
	segments: ISegmentBuffer;
	storage: ISegmentStorageMemory;
}

interface ILogger
{
	error(message: string): void;
}
