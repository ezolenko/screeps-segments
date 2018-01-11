/// <reference types="screeps" />
export interface IBox {
    x: () => number;
    y: () => number;
    w: () => number;
    h: () => number;
}
export interface ICell {
    draw(visual: RoomVisual): ICell;
    box: IBox;
}
export declare class Circle implements ICell {
    private style;
    box: IBox;
    constructor(style: CircleStyle);
    draw(visual: RoomVisual): this;
}
export declare class Rect implements ICell {
    private style;
    box: IBox;
    constructor(style: PolyStyle);
    draw(visual: RoomVisual): this;
}
export declare class Text implements ICell {
    private text;
    private style;
    box: IBox;
    constructor(text: string, style: TextStyle);
    draw(visual: RoomVisual): this;
}
export declare class Grid implements ICell {
    private readonly opts;
    private _box;
    box: IBox;
    private cells;
    private cellWidth;
    private cellHeight;
    readonly rows: number;
    readonly columns: number;
    readonly maxCells: number;
    constructor(opts: {
        columns: number;
        rows: number;
        backgroundStyle?: PolyStyle;
    });
    private convert(index);
    setCellByIndex(index: number, cell: ICell): this;
    setCell(pos: {
        column: number;
        row: number;
    }, cell: ICell): this;
    getCell(pos: {
        column: number;
        row: number;
    }): ICell;
    getCellByIndex(index: number): ICell;
    draw(visual: RoomVisual): this;
}
