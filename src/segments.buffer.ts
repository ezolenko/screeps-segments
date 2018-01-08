import { tracker } from "./runtime.tracker";
import { segmentWrapper } from "./segments.basic.wrapper";
import { Grid, Text } from "./segment.visualizer";
import { log } from "./ilogger";
import { IMemoryRoot } from "./memory.root";

export interface ISegmentMetadata
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
}

export interface ISegmentsBufferEntry
{
	d: string;
	version: number;
	lastWrite: number;
}

export interface ISegmentBuffer
{
	version: number;
	initTick: number;
	metadata: { [id: string]: ISegmentMetadata };
	buffer: { [id: string]: ISegmentsBufferEntry };
	clearCache: { [nodeId: string]: { [id: string]: 1 | undefined } | undefined };
}

declare global
{
	interface Memory
	{
		segments: ISegmentBuffer;
	}
}

export interface ISegmentsCacheEntry
{
	d: string;
	metadata: ISegmentMetadata;
	version: number;
}

export interface ISegmentsCache
{
	initTick: number;
	c: { [id: string]: ISegmentsCacheEntry };
}

export enum eSegmentBufferStatus
{
	Ready = 0,
	NextTick = 1,
	Delayed = 2,
	Empty = 3,
}

const root: IMemoryRoot<ISegmentBuffer> =
{
	get memory(): ISegmentBuffer { return Memory.segments; },
	set memory(value: ISegmentBuffer) { Memory.segments = value; },
	path: "Memory.segments",
};

export class SegmentBuffer
{
	private version = 2;
	private clearDelay = 3;
	private maxBufferSize = 500 * 1024;
	private cache: ISegmentsCache = { initTick: Game.time, c: {} };

	private get memory() { return root.memory; }

	public get maxSize() { return segmentWrapper.maxMemory; }

	private reinitMemory()
	{
		root.memory =
		{
			version: this.version,
			metadata: {},
			buffer: {},
			clearCache: {},
			initTick: Game.time,
		};
	}

	public beforeTick()
	{
		segmentWrapper.beforeTick();

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

			// clearing deleted cache or updating metadata reference
			_.forOwn(this.cache, (e, key) =>
			{
				const id = Number(key);
				const metadata = root.memory.metadata[id];
				if (metadata === undefined)
					delete this.cache.c[id];
				else
					e.metadata = metadata;
			});
		}

		// if buffer is in cache, clear buffer, otherwise upload
		_.forOwn(root.memory.buffer, (buffer, key) =>
		{
			if (buffer === undefined)
				return;

			const id = Number(key);

			const metadata = root.memory.metadata[id];
			if (metadata === undefined)
				return;
			// metadata can never be undefined, see afterTick()

			const cache = this.cache.c[id];
			if (cache === undefined || cache.version < buffer.version)
			{
				this.cache.c[id] =
				{
					d: buffer.d,
					metadata,
					version: buffer.version,
				};
			}

			// if buffer is already saved, but wasn't read for a while, clear
			if (metadata.savedVersion === buffer.version && (Game.time - buffer.lastWrite) > this.clearDelay)
			{
				delete root.memory.buffer[id];
			}
			//else
			//	logger.error(`keeping buffer for ${id}, ${JSON.stringify(buffer)}, savedVersion: ${metadata.savedVersion}, ${this.clearDelay}, age: ${Game.time - buffer.lastWrite}`);
		});
	}

	public afterTick()
	{
		// if cache is newer than saved, try saving
		// if rejected, copy to buffer
		_.forOwn(this.cache.c, (cache, key) =>
		{
			if (cache.version <= cache.metadata.savedVersion)
				return;

			const id = Number(key);

			let writeFailed: boolean;
			if (segmentWrapper.saveSegment(id, cache.d))
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

			if (writeFailed)
			{
				root.memory.buffer[id] =
				{
					d: cache.d,
					version: cache.version,
					lastWrite: Game.time,
				};
			}
		});

		// trim saved buffer if over the limit
		let bufferSize = _.sum(root.memory.buffer, (b) => b.d.length);
		if (bufferSize > this.maxBufferSize)
		{
			_.forOwn(root.memory.buffer, (buffer, key) =>
			{
				if (buffer === undefined)
					return;

				const id = Number(key);

				const metadata = root.memory.metadata[id];
				if (metadata === undefined)
					return;

				if (metadata.savedVersion === buffer.version)
				{
					bufferSize -= buffer.d.length;
					delete root.memory.buffer[id];
				}

				if (bufferSize <= this.maxBufferSize)
					return false;

				return;
			});

			if (bufferSize > this.maxBufferSize)
				log.error(`segments.buffer: failed to trim memory buffer to ${this.maxBufferSize}, overhead: ${bufferSize - this.maxBufferSize}`);
		}

		segmentWrapper.afterTick();
	}

	private getOrCreateMetadata(id: number)
	{
		let metadata = root.memory.metadata[id];
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
			};
			root.memory.metadata[id] = metadata;
		}
		return metadata;
	}

	public getUsedSegments(): number[]
	{
		return Object.keys(root.memory.metadata).map(Number);
	}

	public get(id: number): { status: eSegmentBufferStatus, data?: string }
	{
		const metadata = root.memory.metadata[id];
		if (metadata === undefined)
			return { status: eSegmentBufferStatus.Empty };

		metadata.getCount++;

		const cache = this.cache.c[id];
		if (cache !== undefined && cache.version >= metadata.savedVersion)
			return { status: eSegmentBufferStatus.Ready, data: cache.d };

		metadata.cacheMiss++;

		// if segment is ready, use it, save to cache
		const data = segmentWrapper.getSegment(id);
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
			this.cache.c[id] = entry;

			// buffer is saved for updating other runtimes
			root.memory.buffer[id] =
			{
				d: entry.d,
				version: entry.version,
				lastWrite: Game.time,
			};

			return { status: eSegmentBufferStatus.Ready, data };
		}

		// try requesting segment
		metadata.readRequestCount++;
		metadata.lastReadRequest = Game.time;
		if (segmentWrapper.requestSegment(id))
			return { status: eSegmentBufferStatus.NextTick };

		return { status: eSegmentBufferStatus.Delayed };
	}

	public set(id: number, data: string)
	{
		// updating cached version if exists
		const cache = this.cache.c[id];
		if (cache !== undefined)
		{
			cache.d = data;
			cache.version++;
			cache.metadata.setCount++;
			return;
		}

		// new cached version
		const metadata = this.getOrCreateMetadata(id);
		this.cache.c[id] =
		{
			d: data,
			version: metadata.savedVersion + 1,
			metadata,
		};
		metadata.setCount++;
	}

	public clear(id: number)
	{
		// this tick get will fail because of empty cache
		// next tick/other runtimes cache will be cleared/not restored because of empty metadata
		delete this.cache.c[id];
		delete root.memory.buffer[id];
		delete root.memory.metadata[id];

		const nodes = tracker.activeNodes;
		_.keys(nodes).forEach((nodeId) =>
		{
			if (nodeId === tracker.currentNodeId)
				return;
			if (root.memory.clearCache[nodeId] === undefined)
				root.memory.clearCache[nodeId] = { [id]: 1 };
			else
				root.memory.clearCache[nodeId]![id] = 1;
		});
	}

	public visualize(scale: number)
	{
		const states =
		{
			inCache:
			{
				cell: () => new Text("B", { color: "blue" }),
				pos: { column: 2, row: 2 },
			},
			inBuffer:
			{
				cell: () => new Text("C", { color: "red" }),
				pos: { column: 1, row: 2 },
			},

			savedVersion:
			{
				cell: (text: string) => new Text(text, { color: "green" }),
				pos: { column: 0, row: 3 },
			},
			inBufferVersion:
			{
				cell: (text: string) => new Text(text, { color: "red" }),
				pos: { column: 1, row: 3 },
			},
			inCacheVersion:
			{
				cell: (text: string) => new Text(text, { color: "blue" }),
				pos: { column: 2, row: 3 },
			},

			cacheMiss:
			{
				cell: (text: string) => new Text(text, { color: "red" }),
				pos: { column: 2, row: 4 },
			},
		};

		const grid = segmentWrapper.makeGrid({ columns: 3, rows: 5 });

		for (let id = 0; id < 100; id++)
		{
			const cell = grid.getCellByIndex(id) as Grid;

			const cache = this.cache.c[id];
			if (cache !== undefined)
			{
				cell.setCell(states.inCache.pos, states.inCache.cell());
				cell.setCell(states.inCacheVersion.pos, states.inCacheVersion.cell(`${cache.version}`));
			}

			const buffer = root.memory.buffer[id];
			if (buffer !== undefined)
			{
				cell.setCell(states.inBuffer.pos, states.inBuffer.cell());
				cell.setCell(states.inBufferVersion.pos, states.inBufferVersion.cell(`${buffer.version}`));
			}

			const md = root.memory.metadata[id];
			if (md !== undefined)
			{
				cell.setCell(states.savedVersion.pos, states.savedVersion.cell(`${md.savedVersion}`));
				cell.setCell(states.cacheMiss.pos, states.cacheMiss.cell(`${md.cacheMiss}`));
			}
		}

		grid.box = { x: () => - 0.5, y: () => - 0.5, w: () => 50, h: () => grid.rows * 2 * scale };
		grid.draw(new RoomVisual());
	}

	public forgetAll()
	{
		this.reinitMemory();
		this.cache = { initTick: Game.time, c: {} };
	}
}

export const segmentBuffer = new SegmentBuffer();
