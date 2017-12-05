import { Grid, Text } from "./segment.visualizer";
import { ILogger } from "./ilogger";

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

	public makeGrid(cellSize = { columns: 3, rows: 2 }): Grid
	{
		const states =
		{
			readRequested:
			{
				cell: () =>	new Text("r", { color: "blue" }),
				// cell: () => new Circle({ fill: "blue", stroke: "black", strokeWidth: 0.1 }),
				pos: { column: 0, row: 0 },
			},
			willRead:
			{
				cell: () =>	new Text("R", { color: "blue" }),
				// cell: () => new Rect({ fill: "blue", stroke: "black", strokeWidth: 0.1 }),
				pos: { column: 0, row: 1 },
			},
			writeRequested:
			{
				cell: () =>	new Text("w", { color: "green" }),
				// cell: () => new Circle({ fill: "green", stroke: "black", strokeWidth: 0.1 }),
				pos: { column: 2, row: 0 },
			},
			willWrite:
			{
				cell: () =>	new Text("W", { color: "green" }),
				// cell: () => new Rect({ fill: "green", stroke: "black", strokeWidth: 0.1 }),
				pos: { column: 2, row: 1 },
			},
			available:
			{
				cell: () =>	new Text("A", { color: "green" }),
				// cell: () => new Rect({ fill: "yellow", stroke: "black", strokeWidth: 0.1 }),
				pos: { column: 1, row: 0 },
			},
		};

		const grid = new Grid({ columns: 20, rows: 5 });

		const cellOptions = { ... cellSize, backgroundStyle: { fill: "gray", stroke: "black", strokeWidth: 0.1, opacity: 1 } };

		for (let id = 0; id < 100; id++)
		{
			const cell = new Grid(cellOptions);

			cell.setCell({ column: 1, row: 1 }, new Text(`${id}`, {}));

			if (this.read.has(id))
				cell.setCell(states.available.pos, states.available.cell());

			if (this.willWrite.has(id))
				cell.setCell(states.willWrite.pos, states.willWrite.cell());
			if (this.willRead.has(id))
				cell.setCell(states.willRead.pos, states.willRead.cell());
			if (this.readRequested.has(id))
				cell.setCell(states.readRequested.pos, states.readRequested.cell());
			if (this.writeRequested.has(id))
				cell.setCell(states.writeRequested.pos, states.writeRequested.cell());

			grid.setCellByIndex(id, cell);
		}

		return grid;
	}

	public visualize(scale: number)
	{
		const grid = this.makeGrid();
		grid.box = { x: () => - 0.5, y: () => - 0.5, w: () => 50, h: () => grid.rows * scale };
		grid.draw(new RoomVisual());
	}
}
