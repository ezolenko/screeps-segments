
export interface ISegmentsCacheEntry
{
	d: string;
	metadata: ISegmentMetadata;
	version: number;
}

interface ISegmentsCache
{
	[id: string]: ISegmentsCacheEntry;
}

class RawSegmentWrapper
{
	private saving: number;
	private active: Set<number>;
	public get maxMemory() { return 100 * 1024; }
	public get maxActive() { return 10; }

	constructor(private log: ILogger)
	{
	}

	public beforeTick()
	{
		this.saving = _.size(RawMemory.segments);
		this.active = new Set();
	}

	public afterTick()
	{
		let ids: number[] = [... this.active];
		if (this.active.size > this.maxActive)
		{
			this.log.error(`segments: trying to request ${this.active.size} segments`);
			ids = ids.sort().slice(0, this.maxActive);
		}
		RawMemory.setActiveSegments(ids);
	}

	private checkId(id: number): boolean
	{
		if (!Number.isInteger(id))
		{
			this.log.error(`segments: invalid id '${id}'`);
			return false;
		}
		return true;
	}

	public getSegment(id: number): string | undefined
	{
		if (!this.checkId(id))
			return undefined;
		return RawMemory.segments[id];
	}

	public saveSegment(id: number, data: string): boolean
	{
		if (this.saving > this.maxActive)
			return false;

		if (!this.checkId(id))
			return false;

		if (data.length > this.maxMemory)
		{
			this.log.error(`segments: trying to save ${data.length / 1024} Kb to segment ${id}`);
			return false;
		}

		this.saving++;
		RawMemory.segments[id] = data;

		return true;
	}

	public deleteSegment(id: number): boolean
	{
		if (!this.checkId(id))
			return false;

		if (!_.has(RawMemory.segments, id))
			return false;

		this.saving--;
		delete RawMemory.segments[id];
		return true;
	}

	public requestSegment(id: number): boolean
	{
		if (!this.checkId(id) || this.active.size >= this.maxActive)
			return false;

		this.active.add(id);
		return true;
	}

	public getAvailableSegments(): Set<number>
	{
		if (!RawMemory.segments)
			return new Set();
		return new Set(_.keys(RawMemory.segments).map(Number));
	}
}

export enum eSegmentBufferStatus
{
	Ready,
	Empty,
	NextTick,
	Delayed,
}

export class SegmentBuffer
{
	private s: RawSegmentWrapper;
	private version = 2;
	private clearDelay = 3;
	private cache: ISegmentsCache = {};
	private get memory() { return Memory.segments; }

	constructor(private log: ILogger)
	{
		this.s = new RawSegmentWrapper(this.log);
	}

	public beforeTick()
	{
		this.s.beforeTick();
		if (Memory.segments === undefined || Memory.segments.version !== this.version)
			Memory.segments =
			{
				version: this.version,
				metadata: {},
				buffer: {},
			};

		// clearing deleted cache
		_.forOwn(this.cache, (e, key) =>
		{
			const id = Number(key);
			const metadata = this.memory.metadata[id];
			if (metadata === undefined)
				delete this.cache[id];
			else
				e.metadata = metadata;
		});

		// if buffer is in cache, clear buffer, otherwise upload
		_.forOwn(this.memory.buffer, (buffer, key) =>
		{
			if (buffer === undefined)
				return;

			const id = Number(key);

			const metadata = this.memory.metadata[id];
			// metadata can never be undefined, see afterTick()

			const cache = this.cache[id];
			if (cache === undefined || cache.version < buffer.version)
			{
				this.cache[id] =
				{
					d: buffer.d,
					metadata,
					version: buffer.version,
				};
				buffer.lastRead = Game.time;
			}

			// if buffer is already saved, but wasn't read for a while, clear
			if (metadata.savedVersion === buffer.version && buffer.lastRead >= 0 && Game.time - buffer.lastRead > this.clearDelay)
			{
				if (metadata.locked === 1)
					metadata.lockedCount++;
				else
					delete this.memory.buffer[id];
			}
		});
	}

	public afterTick()
	{
		// if cache is newer than saved, try saving
		// if rejected, copy to buffer
		_.forOwn(this.cache, (cache, key) =>
		{
			if (cache.version <= cache.metadata.savedVersion)
				return;

			const id = Number(key);

			let writeFailed: boolean;
			if (this.s.saveSegment(id, cache.d))
			{
				cache.metadata.savedVersion = cache.version;
				cache.metadata.lastWrite = Game.time;
				cache.metadata.writeCount++;
				writeFailed = false;
			}
			else
			{
				cache.metadata.lastWriteRequest = Game.time;
				cache.metadata.writeRequestCount++;
				writeFailed = true;
			}

			if (writeFailed || cache.metadata.locked === 1)
			{
				this.memory.buffer[id] =
				{
					d: cache.d,
					version: cache.version,
					lastRead: -1,
				};
				if (!writeFailed)
					cache.metadata.lockedCount++;
			}
		});

		this.s.afterTick();
	}

	private getOrCreateMetadata(id: number)
	{
		let metadata = this.memory.metadata[id];
		if (metadata === undefined)
		{
			metadata =
			{
				cacheMiss: 0,
				savedVersion: -1,
				lastWrite: -1,
				lastRead: -1,
				lastReadRequest: -1,
				lastWriteRequest: -1,
				writeCount: 0,
				readCount: 0,
				readRequestCount: 0,
				writeRequestCount: 0,
				setCount: 0,
				getCount: 0,
				lockedCount: 0,
			};
			this.memory.metadata[id] = metadata;
		}
		return metadata;
	}

	public lock(id: number): boolean
	{
		const metadata = this.memory.metadata[id];
		if (metadata === undefined)
			return false;
		metadata.locked = 1;
		return true;
	}

	public unlock(id: number): void
	{
		const metadata = this.memory.metadata[id];
		if (metadata !== undefined)
			metadata.locked = undefined;
	}

	public isLocked(id: number): boolean
	{
		const metadata = this.memory.metadata[id];
		return metadata !== undefined && metadata.locked === 1;
	}

	public get(id: number): { status: eSegmentBufferStatus, data?: string }
	{
		const metadata = this.memory.metadata[id];
		if (metadata === undefined)
			return { status: eSegmentBufferStatus.Empty };

		metadata.getCount++;

		const cache = this.cache[id];
		if (cache !== undefined && cache.version >= metadata.savedVersion)
			return { status: eSegmentBufferStatus.Ready, data: cache.d };

		metadata.cacheMiss++;

		// if segment is ready, use it, save to cache
		const data = this.s.getSegment(id);
		if (data !== undefined)
		{
			metadata.readCount++;
			metadata.lastRead = Game.time;
			const entry =
			{
				d: data,
				metadata,
				version: metadata.savedVersion,
			};
			this.cache[id] = entry;

			// buffer is saved for updating other runtimes
			this.memory.buffer[id] =
			{
				d: entry.d,
				version: entry.version,
				lastRead: -1,
			};

			return { status: eSegmentBufferStatus.Ready, data };
		}

		// try requesting segment
		metadata.readRequestCount++;
		metadata.lastReadRequest = Game.time;
		if (this.s.requestSegment(id))
			return { status: eSegmentBufferStatus.NextTick };

		return { status: eSegmentBufferStatus.Delayed };
	}

	public set(id: number, data: string)
	{
		const metadata = this.getOrCreateMetadata(id);
		metadata.setCount++;

		// updating cached version if exists
		const cache = this.cache[id];
		if (cache !== undefined)
		{
			cache.d = data;
			cache.version++;
			return;
		}

		// new cached version
		this.cache[id] =
		{
			d: data,
			version: 0,
			metadata,
		};
	}

	public clear(id: number)
	{
		// this tick get will fail because of empty cache
		// next tick/other runtimes cache will be cleared/not restored because of empty metadata
		delete this.cache[id];
		delete this.memory.buffer[id];
		delete this.memory.metadata[id];
	}
}

/*
interface ISegmentStorageCache
{
	[label: string]:
	{
		data?: string;
		metadata: ISegmentStorageMetadata;
	};
}

class SegmentStringStorage
{
	private b: SegmentBuffer;
	private cache: ISegmentStorageCache = {};

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

			const metadata = this.memory.metadata[id];

			// clear cache or restore metadata objects
			if (metadata === undefined)
				delete this.cache[id];
			else
				e.metadata = metadata;
		});
	}

	public afterTick()
	{
		this.b.afterTick();
	}

	public setString(label: string, data: string)
	{

	}

	private lock(metadata: ISegmentStorageMetadata)
	{
		if (metadata.locked === undefined)
		{
			metadata.ids.forEach(this.b.lock, this.b);
			metadata.locked = 1;
		}
	}

	private unlock(metadata: ISegmentStorageMetadata)
	{
		if (metadata.locked !== undefined)
		{
			metadata.ids.forEach(this.b.unlock, this.b);
			metadata.locked = undefined;
		}
	}

	public getString(label: string): string | undefined
	{
		// if no metadata, doesn't exist
		const metadata = this.memory.metadata[label];
		if (metadata === undefined)
			return undefined;

		const cache = this.cache[label];
		if (cache === undefined)
		{
			const segments = metadata.ids.map(this.b.get, this.b);

			const entry
		}
	}
}

export const segments = new SegmentStringStorage();
*/