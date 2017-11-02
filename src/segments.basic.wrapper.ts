import { Circle, Grid, Rect, Text } from './segment.visualizer';

export class SegmentsBasicWrapper
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
		const states =
		{
			readRequested:
			{
				cell: () => new Circle({ fill: "blue" }),
				index: 0,
			},
			willRead:
			{
				cell: () => new Rect({ fill: "blue" }),
				index: 0 + 3,
			},
			writeRequested:
			{
				cell: () => new Circle({ fill: "green"}),
				index: 2,
			},
			willWrite:
			{
				cell: () => new Rect({ fill: "green" }),
				index: 2 + 3,
			},
			available:
			{
				cell: () => new Rect({ fill: "yellow" }),
				index: 8,
			},
		};

		const cellStyle: PolyStyle = { fill: "white", stroke: "gray", strokeWidth: 0.1 };

		const grid = new Grid({ columns: 20, rows: 5 });

		for (let id = 0; id < 100; id++)
		{
			const cell = new Grid({ columns: 3, rows: 4, backgroundStyle: cellStyle });

			cell.setCellByIndex(4, new Text(`${id}`, {}));

			if (this.read.has(id))
				cell.setCellByIndex(states.available.index, states.available.cell());

			if (this.willWrite.has(id))
				cell.setCellByIndex(states.willWrite.index, states.willWrite.cell());
			if (this.willRead.has(id))
				cell.setCellByIndex(states.willRead.index, states.willRead.cell());
			if (this.readRequested.has(id))
				cell.setCellByIndex(states.readRequested.index, states.readRequested.cell());
			if (this.writeRequested.has(id))
				cell.setCellByIndex(states.writeRequested.index, states.writeRequested.cell());

			grid.setCellByIndex(id, cell);
		}

		grid.box = { x: () => sx - 0.5, y: () => sy - 0.5, w: () => 50, h: () => grid.rows * scale };

		grid.draw(new RoomVisual());
	}
}
