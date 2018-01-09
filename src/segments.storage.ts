import { eSegmentBufferStatus, segmentBuffer } from "./segments.buffer";
import { log } from "./ilogger";
import { IMemoryRoot } from "./memory.root";

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
	version: number;
	initTick: number;
	m: {[label: string]: ISegmentStorageMetadata; };
}

declare global
{
	interface Memory
	{
		storage: ISegmentStorage;
	}
}

const root: IMemoryRoot<ISegmentStorage> =
{
	get memory(): ISegmentStorage { return Memory.storage; },
	set memory(value: ISegmentStorage) { Memory.storage = value; },
	path: "Memory.storage",
};

export class SegmentStringStorage
{
	private version = 0;
	private cache: ISegmentStorageCache = {};
	private availableSegments: number[] = _.range(0, 99);

	private get memory() { return root.memory; }

	private reinitMemory()
	{
		root.memory =
		{
			version: this.version,
			initTick: Game.time,
			m: {},
		};
	}

	public beforeTick()
	{
		segmentBuffer.beforeTick();

		if (root.memory === undefined || root.memory.version !== this.version)
			this.reinitMemory();

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
		const freeSegments = _.difference(this.availableSegments, segmentBuffer.getUsedSegments());
		const maxSize = segmentBuffer.maxSize;

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
					log.error(`SegmentStringStorage: run out of segments, dropping data: '${label}'`);
				else
					segmentBuffer.set(id, cache.data);
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
				log.error(`SegmentStringStorage: run out of segments, dropping data: '${label}'`);
				return;
			}

			parts.map((part) => segmentBuffer.set(freeSegments.pop()!, part));
		});

		segmentBuffer.afterTick();

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
		{
			metadata = { v: -1, ids: [] };
			this.memory.m[label] = metadata;
		}

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

		const segments = metadata.ids.map(segmentBuffer.get, segmentBuffer);

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

	public visualize(scale: number)
	{
		segmentBuffer.visualize(scale);
	}
}

export const segmentStorage = new SegmentStringStorage();
