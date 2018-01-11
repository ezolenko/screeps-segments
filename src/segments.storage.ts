import { eSegmentBufferStatus, segmentBuffer } from "./segments.buffer";
import { log } from "./ilogger";
import { IMemoryRoot } from "./memory.root";
import { tracker } from "./runtime.tracker";

export interface ISegmentStorageMetadata
{
	ids: number[];
	v: number;
}

interface ISegmentStorageCache
{
	initTick: number;
	c: { [label: string]:
	{
		data?: string;
		v: number;
		metadata: ISegmentStorageMetadata;
	}};
}

export interface ISegmentStorage
{
	version: number;
	initTick: number;
	m: {[label: string]: ISegmentStorageMetadata; };
	clearCache: { [nodeId: string]: { [label: string]: 1 | undefined } | undefined };
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
	private cache: ISegmentStorageCache = { initTick: Game.time, c: {} };
	private availableSegments: number[] = _.range(0, 100);

	private get memory() { return root.memory; }

	private reinitMemory()
	{
		root.memory =
		{
			version: this.version,
			initTick: Game.time,
			m: {},
			clearCache: {},
		};
	}

	public reset()
	{
		segmentBuffer.reset();
		this.reinitMemory();
	}

	public beforeTick()
	{
		segmentBuffer.beforeTick();

		if (root.memory === undefined || root.memory.version !== this.version)
			this.reinitMemory();

		if (root.memory.initTick !== this.cache.initTick)
			this.cache = { initTick: root.memory.initTick, c: {} };
		else
		{
			// clearing marked entries
			const clear = root.memory.clearCache[tracker.currentNodeId];
			_.forOwn(clear!, (_e, key) => delete this.cache.c[key!]);
			root.memory.clearCache[tracker.currentNodeId] = undefined;

			// clearing marks for inactive nodes
			if (Game.time % 10 === 0)
			{
				_.forOwn(root.memory.clearCache, (_e, key) =>
				{
					if (!_.has(tracker.activeNodes, key!))
						delete root.memory.clearCache[key!];
				});
			}

			_.forOwn(this.cache, (e, key) =>
			{
				const id = Number(key);

				const metadata = root.memory.m[id];

				// clear cache or restore metadata objects
				if (metadata === undefined)
					delete this.cache.c[id];
				else
					e.metadata = metadata;
			});
		}
	}

	public afterTick()
	{
		const freeSegments = _.difference(this.availableSegments, segmentBuffer.getUsedSegments());
		const maxSize = segmentBuffer.maxSize;

		_.forOwn(this.cache.c, (cache, label) =>
		{
			if (cache.v <= cache.metadata.v)
				return;

			if (cache.data === undefined)
				return;

			// releasing segments
			cache.metadata.ids.forEach((id) => segmentBuffer.clear(id));

			if (cache.data.length <= maxSize)
			{
				const id = freeSegments.pop();
				if (id === undefined)
					log.error(`SegmentStringStorage: run out of segments, dropping data: '${label}'`);
				else
				{
					segmentBuffer.set(id, cache.data);
					cache.metadata.ids = [ id ];
					cache.metadata.v = cache.v;
				}
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

			cache.metadata.ids = [];
			parts.map((part) =>
			{
				const id = freeSegments.pop();
				if (id !== undefined)
				{
					segmentBuffer.set(id, part);
					cache.metadata.ids.push(id);
					cache.metadata.v = cache.v;
				}
			});
		});

		segmentBuffer.afterTick();

		return freeSegments;
	}

	public set(label: string, data: string)
	{
		// updating cached version if exists
		const cache = this.cache.c[label];
		if (cache !== undefined)
		{
			log.error(`new data for '${label}'`);
			cache.v++;
			cache.data = data;
			return;
		}

		let metadata = root.memory.m[label];
		if (metadata === undefined)
		{
			log.error(`new '${label}'`);
			metadata = { v: -1, ids: [] };
			root.memory.m[label] = metadata;
		}

		this.cache.c[label] =
		{
			v: metadata.v + 1,
			data,
			metadata,
		};
	}

	public get(label: string): { status: eSegmentBufferStatus, data?: string, partial?: string }
	{
		// if no metadata, doesn't exist
		const metadata = root.memory.m[label];
		if (metadata === undefined)
			return { status: eSegmentBufferStatus.Empty };

		const cache = this.cache.c[label];
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

			this.cache.c[label] = cache;

			return { status: eSegmentBufferStatus.Ready, data: cache.data };
		}

		if (parts.length >= 0)
			return { status, partial: parts.join("") };

		return { status };
	}

	public clear(label: string): void
	{
		delete this.cache.c[label];

		const metadata = root.memory.m[label];
		if (metadata === undefined)
			return;

		metadata.ids.forEach((id) => segmentBuffer.clear(id));

		const nodes = tracker.activeNodes;
		_.keys(nodes).forEach((nodeId) =>
		{
			if (nodeId === tracker.currentNodeId)
				return;
			if (root.memory.clearCache[nodeId] === undefined)
				root.memory.clearCache[nodeId] = { [label]: 1 };
			else
				root.memory.clearCache[nodeId]![label] = 1;
		});

		delete root.memory.m[label];
	}

	public visualize(scale: number)
	{
		segmentBuffer.visualize(scale);
	}
}

export const segmentStorage = new SegmentStringStorage();
