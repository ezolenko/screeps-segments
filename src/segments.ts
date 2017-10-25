
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

export class RawSegmentWrapper
{
	private readRequested: Set<number>;
	private willRead: Set<number>;
	private writeRequested: Set<number>;
	private willWrite: Set<number>;
	private read: Map<number, string>;

	public get maxSegments() { return 100; }
	public get maxMemory() { return 100 * 1024; }
	public get maxActive() { return 10; }

	constructor(private log: ILogger)
	{
	}

	public beforeTick()
	{
		this.readRequested = new Set();
		this.willRead = new Set();
		this.writeRequested = new Set();
		this.willWrite = new Set();
		this.read = new Map();

		_.each(RawMemory.segments, (data: string, key) =>
		{
			const id = this.checkId(key);
			if (id !== undefined && data !== undefined)
			{
				this.read.set(id, data);
				delete RawMemory.segments[id];
			}
		});
	}

	public afterTick()
	{
		const ids: number[] = [... this.willRead];
		RawMemory.setActiveSegments(ids);

		this.read.clear();
	}

	private checkId(id: number | string | undefined): number | undefined
	{
		const fixed = Number(id);
		if (!Number.isInteger(fixed) || fixed < 0 || fixed >= this.maxSegments)
		{
			this.log.error(`segments: invalid id '${id}'`);
			return undefined;
		}
		return fixed;
	}

	public getSegment(id: number): string | undefined
	{
		const fixed = this.checkId(id);
		return fixed === undefined ? undefined : this.read.get(fixed);
	}

	public saveSegment(id: number, data: string): boolean
	{
		const fixed = this.checkId(id);
		if (fixed === undefined)
			return false;

		this.writeRequested.add(fixed);

		if (this.willWrite.size >= this.maxActive)
			return false;

		if (data.length > this.maxMemory)
		{
			this.log.error(`segments: trying to save ${data.length / 1024} Kb to segment ${fixed}`);
			return false;
		}

		this.willWrite.add(fixed);
		this.read.set(fixed, data);
		RawMemory.segments[fixed] = data;

		return true;
	}

	public deleteSegment(id: number): boolean
	{
		const fixed = this.checkId(id);
		if (fixed === undefined)
			return false;

		if (this.willWrite.delete(fixed))
		{
			this.writeRequested.delete(fixed);
			delete RawMemory.segments[fixed];
			return true;
		}

		return false;
	}

	public requestSegment(id: number): boolean
	{
		const fixed = this.checkId(id);
		if (fixed === undefined)
			return false;

		this.readRequested.add(fixed);

		if (this.willRead.size >= this.maxActive)
			return false;

		this.willRead.add(fixed);

		return true;
	}

	public visualize(sx: number, sy: number, scale: number)
	{
		const visual = new RoomVisual();

		const segmentIdStyle: TextStyle = {};

		const cellStyle: PolyStyle = { fill: "white", stroke: "gray", strokeWidth: 0.1 };
		const read: PolyStyle = { fill: "blue", stroke: "blue", strokeWidth: 0.1 };
		const written: PolyStyle = { fill: "green", stroke: "green", strokeWidth: 0.1 };

		const readRequested: CircleStyle = { radius: 0.1 * scale, fill: "blue" };
		const writeRequested: CircleStyle = { radius: 0.1 * scale, fill: "green" };

		for (let row = 0; row < 5; row++)
			for (let column = 0; column < 20; column++)
			{
				const id = 20 * row + column;
				const x = sx + column * scale;
				const y = sy + row * scale;

				visual.rect(x, y, 1 * scale, 1 * scale, cellStyle);

				if (this.read.has(id))
					visual.rect(x, y, 1 * scale, 0.3 * scale, read);

				if (this.willWrite.has(id))
					visual.rect(x, y + 0.7 * scale, 0.5 * scale, 0.3 * scale, written);
				if (this.willRead.has(id))
					visual.rect(x + 0.5 * scale, y + 0.7 * scale, 0.5 * scale, 0.3 * scale, read);

				if (this.readRequested.has(id))
					visual.circle(x + 0.3, y + 0.5 * scale, readRequested);

				if (this.writeRequested.has(id))
					visual.circle(x + 0.3, y + 0.5 * scale, writeRequested);

				visual.text(`${id}`, x + 0.5 * scale, y + 0.5 * scale, segmentIdStyle);
			}
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
