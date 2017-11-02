export interface IBox
{
	x: () => number;
	y: () => number;
	w: () => number;
	h: () => number;
}

export interface ICell
{
	draw(visual: RoomVisual): void;
	box: IBox;
}

export class Circle implements ICell
{
	public box: IBox;

	constructor(private style: CircleStyle)
	{
	}

	public draw(visual: RoomVisual): void
	{
		const radius = this.box.w() / 2;
		this.style.radius = radius;
		visual.circle(this.box.x() + radius, this.box.y() + this.box.h() / 2, this.style);
	}
}

export class Rect implements ICell
{
	public box: IBox;

	constructor(private style: PolyStyle)
	{
	}

	public draw(visual: RoomVisual): void
	{
		visual.rect(this.box.x(), this.box.y(), this.box.w(), this.box.h(), this.style);
	}
}

export class Grid implements ICell
{
	public box: IBox;
	private cells: { [column: string]: { [row: string]: ICell } } = {};

	constructor(private columns: number, private cellHeight: number, private cellWidth: number)
	{
	}

	private convert(index: number): { column: number, row: number }
	{
		const column = index % this.columns;
		const row = Math.floor(index / this.columns);

		return { column, row };
	}

	public setCell(index: number, cell: ICell): void
	{
		const { row, column } = this.convert(index);

		if (this.cells[column] === undefined)
			this.cells[column] = {};

		this.cells[column][row] = cell;

		cell.box =
		{
			x: () => this.box.x() + column * this.cellWidth,
			y: () => this.box.y() + row * this.cellHeight,
			h: () => this.cellHeight,
			w: () => this.cellWidth,
		};
	}

	public draw(visual: RoomVisual)
	{
		_.flatten(_.map(this.cells, (e) => _.map(e, (c) => c))).forEach((c) => c.draw(visual));
	}
}
