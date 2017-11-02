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
		const xscale = 0.5 * scale;
		const yscale = 1 * scale;
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
				const x = sx + column * xscale;
				const y = sy + row * yscale;

				visual.rect(x, y, 1 * xscale, 1 * yscale, cellStyle);

				if (this.read.has(id))
					visual.rect(x, y, 1 * xscale, 0.3 * yscale, read);

				if (this.willWrite.has(id))
					visual.rect(x, y + 0.7 * yscale, 0.5 * xscale, 0.3 * yscale, written);
				if (this.willRead.has(id))
					visual.rect(x + 0.5 * xscale, y + 0.7 * yscale, 0.5 * xscale, 0.3 * xscale, read);

				if (this.readRequested.has(id))
					visual.circle(x + 0.3, y + 0.5 * yscale, readRequested);

				if (this.writeRequested.has(id))
					visual.circle(x + 0.3, y + 0.5 * yscale, writeRequested);

				visual.text(`${id}`, x + 0.5 * xscale, y + 0.5 * yscale, segmentIdStyle);
			}
	}
}
