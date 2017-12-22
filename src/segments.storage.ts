import { eSegmentBufferStatus, SegmentBuffer } from "./segments.buffer";
import { ILogger } from "./ilogger";

export interface ISegmentStorageMetadata
{
	ids: number[];
	v: number;
}

interface ISegmentStorageCache
{
	[label: string]:
	{
		data?: string;
		v: number;
		metadata: ISegmentStorageMetadata;
	};
}

export interface ISegmentStorage
{
	m: {[label: string]: ISegmentStorageMetadata; };
}

declare global
{
	interface Memory
	{
		storage: ISegmentStorage;
	}
}

export class SegmentStringStorage
{
	private b: SegmentBuffer;
	private cache: ISegmentStorageCache = {};
	private availableSegments: number[] = _.range(0, 99);

	private get memory() { return Memory.storage; }

	constructor(private log: ILogger)
	{
		this.b = new SegmentBuffer(this.log);
	}

	public beforeTick()
	{
		this.b.beforeTick();

		_.forOwn(this.cache, (e, key) =>
		{
			const id = Number(key);

			const metadata = this.memory.m[id];

			// clear cache or restore metadata objects
			if (metadata === undefined)
				delete this.cache[id];
			else
				e.metadata = metadata;
		});
	}

	public afterTick()
	{
		const freeSegments = _.difference(this.availableSegments, this.b.getUsedSegments());
		const maxSize = this.b.maxSize;

		_.forOwn(this.cache, (cache, label) =>
		{
			if (cache.v <= cache.metadata.v)
				return;

			if (cache.data === undefined)
				return;

			if (cache.data.length <= maxSize)
			{
				const id = freeSegments.pop();
				if (id === undefined)
					this.log.error(`SegmentStringStorage: run out of segments, dropping data: '${label}'`);
				else
					this.b.set(id, cache.data);
				return;
			}

			const parts: string[] = [];
			let start = 0;
			while (start < cache.data.length)
			{
				const remaining = cache.data.length - start;
				const end = start + Math.min(remaining, maxSize);

				parts.push(cache.data.slice(start, end));

				start = end;
			}

			if (freeSegments.length < parts.length)
			{
				this.log.error(`SegmentStringStorage: run out of segments, dropping data: '${label}'`);
				return;
			}

			parts.map((part) => this.b.set(freeSegments.pop()!, part));
		});

		this.b.afterTick();

		return freeSegments;
	}

	public setString(label: string, data: string)
	{
		// updating cached version if exists
		const cache = this.cache[label];
		if (cache !== undefined)
		{
			cache.v++;
			cache.data = data;
			return;
		}

		let metadata = this.memory.m[label];
		if (metadata === undefined)
			metadata = { v: -1, ids: [] };

		this.cache[label] =
		{
			v: metadata.v + 1,
			data,
			metadata,
		};
	}

	public getString(label: string): { status: eSegmentBufferStatus, data?: string, partial?: string }
	{
		// if no metadata, doesn't exist
		const metadata = this.memory.m[label];
		if (metadata === undefined)
			return { status: eSegmentBufferStatus.Empty };

		const cache = this.cache[label];
		if (cache !== undefined && cache.v >= metadata.v)
			return { status: eSegmentBufferStatus.Ready, data: cache.data };

		const segments = metadata.ids.map(this.b.get, this.b);

		const parts: string[] = [];
		let status: eSegmentBufferStatus = eSegmentBufferStatus.Ready;
		for (const entry of segments)
		{
			if (entry.status > status)
				status = entry.status;

			if (status === eSegmentBufferStatus.Ready && entry.data !== undefined)
				parts.push(entry.data);
		}

		if (status === eSegmentBufferStatus.Ready && parts.length === segments.length)
		{
			const cache =
			{
				v: metadata.v,
				data: parts.join(""),
				metadata,
			};

			this.cache[label] = cache;

			return { status: eSegmentBufferStatus.Ready, data: cache.data };
		}

		if (parts.length === 0)
			return { status, partial: parts.join("") };

		return { status };
	}
}
