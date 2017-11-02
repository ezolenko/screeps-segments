export interface IBox
{
	x: () => number;
	y: () => number;
	w: () => number;
	h: () => number;
}

export interface ICell
{
	draw(visual: RoomVisual): ICell;
	box: IBox;
}

export class Circle implements ICell
{
	public box: IBox;

	constructor(private style: CircleStyle) { }

	public draw(visual: RoomVisual)
	{
		const radius = Math.min(this.box.w() / 2, this.box.h() / 2);
		this.style.radius = radius;
		visual.circle(this.box.x() + this.box.w() / 2, this.box.y() + this.box.h() / 2, this.style);
		return this;
	}
}

export class Rect implements ICell
{
	public box: IBox;

	constructor(private style: PolyStyle) { }

	public draw(visual: RoomVisual)
	{
		visual.rect(this.box.x(), this.box.y(), this.box.w(), this.box.h(), this.style);
		return this;
	}
}

export class Text implements ICell
{
	public box: IBox;

	constructor(private text: string, private style: TextStyle) { }

	public draw(visual: RoomVisual)
	{
		visual.text(this.text, this.box.x() + this.box.w() / 2, this.box.y() + this.box.h() / 2, this.style);
		return this;
	}
}

export class Grid implements ICell
{
	private _box: IBox;

	public get box() { return this._box; }
	public set box(value: IBox)
	{
		this._box = value;
		this.cellWidth = _.memoize(() => this._box.w() / this.opts.columns);
		this.cellHeight = _.memoize(() => this._box.h() / this.opts.rows);
	}

	private cells: { [column: string]: { [row: string]: ICell } } = {};
	private cellWidth: () => number = () => 1;
	private cellHeight: () => number = () => 1;

	public get rows() { return this.opts.rows; }
	public get columns() { return this.opts.columns; }
	public get maxCells() { return this.opts.rows * this.opts.columns; }

	constructor(private readonly opts: { columns: number, rows: number, backgroundStyle?: PolyStyle }) { }

	private convert(index: number): { column: number, row: number }
	{
		const column = index % this.opts.columns;
		const row = Math.floor(index / this.opts.columns);

		return { column, row };
	}

	public setCellByIndex(index: number, cell: ICell)
	{
		return this.setCell(this.convert(index), cell);
	}

	public setCell(pos: { column: number, row: number }, cell: ICell)
	{
		if (this.cells[pos.column] === undefined)
			this.cells[pos.column] = {};

		this.cells[pos.column][pos.row] = cell;

		cell.box =
		{
			x: _.memoize(() => this.box.x() + pos.column * this.cellWidth()),
			y: _.memoize(() => this.box.y() + pos.row * this.cellHeight()),
			h: () => this.cellHeight(),
			w: () => this.cellWidth(),
		};

		return this;
	}

	public draw(visual: RoomVisual)
	{
		if (this.opts.backgroundStyle !== undefined)
			visual.rect(this.box.x(), this.box.y(), this.box.w(), this.box.h(), this.opts.backgroundStyle);

		_.flatten(_.map(this.cells, (e) => _.map(e, (c) => c))).forEach((c) => c.draw(visual));
		return this;
	}
}
