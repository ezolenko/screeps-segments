export interface SourcePos {
    compiled: string;
    final: string;
    original?: string;
    caller?: string;
    path?: string;
    line?: number;
    code?: string;
}
export interface IVscInfo {
    repo: string;
    buildRoot: string;
    revision: string;
    valid: "true" | string;
    revCount: string;
    branch: string;
}
export declare class SourceMapWrapper {
    private sourceMap;
    private vscTemplate;
    setVscTemplate(template: (info: IVscInfo, path: string, line: number) => string): void;
    private vscInfo;
    setVscInfo(info: IVscInfo): void;
    constructor();
    resolve(fileLine: string): SourcePos;
    private vscUrl(path, line);
    makeVscLink(pos: SourcePos): string;
    getFileLine(upStack: number, resolve: boolean): SourcePos;
    private loadSourceMap();
}
export declare const sourceMap: SourceMapWrapper;
