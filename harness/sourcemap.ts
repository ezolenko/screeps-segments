import * as SourceMap from "source-map";

export interface SourcePos
{
	compiled: string;
	final: string;
	original?: string;
	caller?: string;
	path?: string;
	line?: number;
	code?: string;
}

export interface IVscInfo
{
	repo: string;
	revision: string;
	valid: "true" | string;
	revCount: string;
	branch: string;
}

// <caller> (<source>:<line>:<column>)
const stackLineRe = /([^ ]*) \(([^:]*):([0-9]*):([0-9]*)\)/;

function link(href: string, title: string): string
{
	return `<a href='${href}' target="_blank">${title}</a>`;
}

export class SourceMapWrapper
{
	private sourceMap: SourceMap.SourceMapConsumer | undefined;
	private vscTemplate = (info: IVscInfo, path: string, line: number) => `${info.repo}/blob/${info.revision}/${path}#L${line}`;
	public setVscTemplate(template: (info: IVscInfo, path: string, line: number) => string) { this.vscTemplate = template; }

	private vscInfo: IVscInfo | undefined;
	public setVscInfo(info: IVscInfo) { this.vscInfo = info; }

	constructor()
	{
		this.sourceMap = this.loadSourceMap();
	}

	public resolve(fileLine: string): SourcePos
	{
		if (!this.sourceMap)
			return { compiled: fileLine, final: fileLine };

		const split = _.trim(fileLine).match(stackLineRe);
		if (!split)
			return { compiled: fileLine, final: fileLine };

		const pos = { column: parseInt(split[4], 10), line: parseInt(split[3], 10) };

		const original = this.sourceMap.originalPositionFor(pos);
		const line = `${split[1]} (${original.source}:${original.line})`;

		let code: string | undefined;
		if (original.source !== null && original.line !== null)
		{
			const file = original.source !== null ? this.sourceMap.sourceContentFor(original.source, true) : null;
			if (file !== null)
			{
				const lines = file.split("\n", original.line);
				code = _.trim(lines[original.line - 1]);
			}
		}

		const out =
		{
			caller: split[1],
			compiled: fileLine,
			final: line,
			line: original.line === null ? undefined : original.line,
			original: line,
			path: original.source === null ? undefined : original.source,
			code,
		};

		return out;
	}

	private vscUrl(path: string, line: number)
	{
		return this.vscTemplate(this.vscInfo!, path, line);
	}

	public makeVscLink(pos: SourcePos)
	{
		if (this.vscInfo === undefined || this.vscInfo.valid !== "true" || pos.caller === undefined || pos.path === undefined || pos.path === null || pos.line === undefined || pos.line === null || pos.original === undefined)
			return pos.final;

		return link(this.vscUrl(pos.path, pos.line), pos.original);
	}

	public getFileLine(upStack: number, resolve: boolean): SourcePos
	{
		const stack = new Error("").stack;
		if (stack !== undefined)
		{
			const lines = stack.split("\n");
			if (lines.length > upStack + 2)
			{
				const compiled = lines[upStack + 2];
				if (resolve)
				{
					const line = this.resolve(compiled);
					return line;
				}
				else
				{
					const line = _.trim(compiled);
					return {
						compiled: line,
						final: line,
					};
				}
			}
			else
				throw new Error(`can't get line ${upStack} in stack:\n${stack}`);
		}
		else throw new Error(`can't get call stack`);
	}

	private loadSourceMap()
	{
		try
		{
			const map = require("main.js.map").d;
			if (map)
				return new SourceMap.SourceMapConsumer(map);
		}
		catch (err)
		{
			console.log("failed lo load source map", err);
		}
		return undefined;
	}
}

export const sourceMap = new SourceMapWrapper();
