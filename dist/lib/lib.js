/* eslint-disable */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const root$1 = {
    get memory() { return Memory.runtimes; },
    set memory(value) { Memory.runtimes = value; },
    path: "Memory.runtimes",
};
const currentNodeId = String(Game.time);
class RuntimeTracker {
    constructor() {
        this._activeNodes = {};
    }
    get isLoadTick() { return root$1.memory.nodes[this.currentNodeId].totalReuse === 1; }
    get currentNodeId() { return currentNodeId; }
    get switchedNodes() { return root$1.memory.lastNode !== this.currentNodeId; }
    isActive(nodeId) { return _.has(this._activeNodes, nodeId); }
    get activeNodes() { return this._activeNodes; }
    get memory() { return root$1.memory; }
    beforeTick() {
        if (root$1.memory === undefined) {
            root$1.memory =
                {
                    nodes: {
                        [this.currentNodeId]: {
                            reuse: 1,
                            totalReuse: 1,
                            lastSeen: Game.time,
                        },
                    },
                };
        }
        else {
            if (root$1.memory.nodes[this.currentNodeId] === undefined) {
                root$1.memory.nodes[this.currentNodeId] =
                    {
                        reuse: 1,
                        totalReuse: 1,
                        lastSeen: Game.time,
                    };
            }
            else {
                const node = root$1.memory.nodes[this.currentNodeId];
                node.lastSeen = Game.time;
                node.totalReuse += 1;
                node.reuse += 1;
            }
            _.each(root$1.memory.nodes, (node, key) => {
                if (key === undefined || key === this.currentNodeId)
                    return;
                node.reuse = 0;
                if (Game.time - node.lastSeen > 100)
                    delete root$1.memory.nodes[key];
            });
        }
        this._activeNodes = this.getActiveNodes();
    }
    getActiveNodes() {
        const nodes = _
            .map(root$1.memory.nodes, (node, id) => {
            return {
                id: id,
                node,
                diff: 0,
                p: Game.time - node.lastSeen + node.totalReuse,
            };
        })
            .sort((e) => e.p);
        if (nodes.length === 0)
            return {};
        for (let i = 1; i < nodes.length; ++i)
            nodes[i].diff = nodes[i].p / nodes[i - 1].p;
        return nodes.slice(0, _.findIndex(nodes, (e) => e.diff > 2)).map((e) => ({ [e.id]: e.node })).reduce(_.merge, {});
    }
    report() {
        const active = this.getActiveNodes();
        return `T: ${Game.time}, last id: ${root$1.memory.lastNode}, ${this.switchedNodes ? "switched" : "same node"}\n\t` + _.map(root$1.memory.nodes, (node, key) => {
            return `${key === this.currentNodeId ? "N" : "n"}${_.has(active, key) ? "A" : "i"}[id: ${key}, t: ${node.totalReuse}, run: ${node.reuse}, lr: ${Game.time - node.lastSeen}]`;
        }).join("\n\t");
    }
    afterTick() {
        root$1.memory.lastNode = this.currentNodeId;
    }
}
const tracker = new RuntimeTracker();

class Circle {
    constructor(style) {
        this.style = style;
    }
    draw(visual) {
        const radius = Math.min(this.box.w() / 2, this.box.h() / 2);
        this.style.radius = radius;
        visual.circle(this.box.x() + this.box.w() / 2, this.box.y() + this.box.h() / 2, this.style);
        return this;
    }
}
class Rect {
    constructor(style) {
        this.style = style;
    }
    draw(visual) {
        visual.rect(this.box.x(), this.box.y(), this.box.w(), this.box.h(), this.style);
        return this;
    }
}
class Text {
    constructor(text, style) {
        this.text = text;
        this.style = style;
    }
    draw(visual) {
        visual.text(this.text, this.box.x() + this.box.w() / 2, this.box.y() + this.box.h() / 2, this.style);
        return this;
    }
}
class Grid {
    constructor(opts) {
        this.opts = opts;
        this.cells = {};
        this.cellWidth = () => 1;
        this.cellHeight = () => 1;
    }
    get box() { return this._box; }
    set box(value) {
        this._box = value;
        this.cellWidth = _.memoize(() => this._box.w() / this.opts.columns);
        this.cellHeight = _.memoize(() => this._box.h() / this.opts.rows);
    }
    get rows() { return this.opts.rows; }
    get columns() { return this.opts.columns; }
    get maxCells() { return this.opts.rows * this.opts.columns; }
    convert(index) {
        const column = index % this.opts.columns;
        const row = Math.floor(index / this.opts.columns);
        return { column, row };
    }
    setCellByIndex(index, cell) {
        return this.setCell(this.convert(index), cell);
    }
    setCell(pos, cell) {
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
    getCell(pos) {
        return _.get(this.cells, [pos.column, pos.row]);
    }
    getCellByIndex(index) {
        return this.getCell(this.convert(index));
    }
    draw(visual) {
        if (this.opts.backgroundStyle !== undefined)
            visual.rect(this.box.x(), this.box.y(), this.box.w(), this.box.h(), this.opts.backgroundStyle);
        _.flatten(_.map(this.cells, (e) => _.map(e, (c) => c))).forEach((c) => c.draw(visual));
        return this;
    }
}

class Logger {
    error(message) {
        console.log(message);
    }
    info(message) {
        console.log(message);
    }
}
exports.log = new Logger();
function setLogger(_log) {
    exports.log = _log;
}

class SegmentsBasicWrapper {
    get maxSegments() { return 100; }
    get maxMemory() { return 100 * 1024; }
    get maxActive() { return 10; }
    beforeTick() {
        this.readRequested = new Set();
        this.willRead = new Set();
        this.writeRequested = new Set();
        this.willWrite = new Set();
        this.read = new Map();
        _.each(RawMemory.segments, (data, key) => {
            const id = this.checkId(key);
            if (id !== undefined && data !== undefined) {
                this.read.set(id, data);
                delete RawMemory.segments[id];
            }
        });
    }
    afterTick() {
        const ids = [...this.willRead];
        RawMemory.setActiveSegments(ids);
        this.read.clear();
    }
    checkId(id) {
        const fixed = Number(id);
        if (!Number.isInteger(fixed) || fixed < 0 || fixed >= this.maxSegments) {
            exports.log.error(`segments: invalid id '${id}'`);
            return undefined;
        }
        return fixed;
    }
    getSegment(id) {
        const fixed = this.checkId(id);
        return fixed === undefined ? undefined : this.read.get(fixed);
    }
    saveSegment(id, data) {
        const fixed = this.checkId(id);
        if (fixed === undefined)
            return false;
        this.writeRequested.add(fixed);
        if (this.willWrite.size >= this.maxActive)
            return false;
        if (data.length > this.maxMemory) {
            exports.log.error(`segments: trying to save ${data.length / 1024} Kb to segment ${fixed}`);
            return false;
        }
        this.willWrite.add(fixed);
        this.read.set(fixed, data);
        RawMemory.segments[fixed] = data;
        return true;
    }
    deleteSegment(id) {
        const fixed = this.checkId(id);
        if (fixed === undefined)
            return false;
        if (this.willWrite.delete(fixed)) {
            this.writeRequested.delete(fixed);
            delete RawMemory.segments[fixed];
            return true;
        }
        return false;
    }
    requestSegment(id) {
        const fixed = this.checkId(id);
        if (fixed === undefined)
            return false;
        this.readRequested.add(fixed);
        if (this.willRead.size >= this.maxActive)
            return false;
        this.willRead.add(fixed);
        return true;
    }
    makeGrid(cellSize = { columns: 3, rows: 2 }) {
        const states = {
            readRequested: {
                cell: () => new Text("r", { color: "blue" }),
                pos: { column: 0, row: 0 },
            },
            willRead: {
                cell: () => new Text("R", { color: "blue" }),
                pos: { column: 0, row: 1 },
            },
            writeRequested: {
                cell: () => new Text("w", { color: "green" }),
                pos: { column: 2, row: 0 },
            },
            willWrite: {
                cell: () => new Text("W", { color: "green" }),
                pos: { column: 2, row: 1 },
            },
            available: {
                cell: () => new Text("A", { color: "green" }),
                pos: { column: 1, row: 0 },
            },
        };
        const grid = new Grid({ columns: 20, rows: 5 });
        const cellOptions = Object.assign({}, cellSize, { backgroundStyle: { fill: "gray", stroke: "black", strokeWidth: 0.1, opacity: 1 } });
        for (let id = 0; id < 100; id++) {
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
    visualize(scale) {
        const grid = this.makeGrid();
        grid.box = { x: () => -0.5, y: () => -0.5, w: () => 50, h: () => grid.rows * scale };
        grid.draw(new RoomVisual());
    }
}
const segmentWrapper = new SegmentsBasicWrapper();

(function (eSegmentBufferStatus) {
    eSegmentBufferStatus[eSegmentBufferStatus["Ready"] = 0] = "Ready";
    eSegmentBufferStatus[eSegmentBufferStatus["NextTick"] = 1] = "NextTick";
    eSegmentBufferStatus[eSegmentBufferStatus["Delayed"] = 2] = "Delayed";
    eSegmentBufferStatus[eSegmentBufferStatus["Empty"] = 3] = "Empty";
})(exports.eSegmentBufferStatus || (exports.eSegmentBufferStatus = {}));
const root = {
    get memory() { return Memory.segments; },
    set memory(value) { Memory.segments = value; },
    path: "Memory.segments",
};
class SegmentBuffer {
    constructor() {
        this.version = 2;
        this.clearDelay = 3;
        this.maxBufferSize = 500 * 1024;
        this.cache = { initTick: Game.time, c: {} };
    }
    get memory() { return root.memory; }
    get maxSize() { return segmentWrapper.maxMemory; }
    reinitMemory() {
        root.memory =
            {
                version: this.version,
                metadata: {},
                buffer: {},
                clearCache: {},
                initTick: Game.time,
            };
    }
    reset() {
        this.forgetAll();
    }
    beforeTick() {
        segmentWrapper.beforeTick();
        if (root.memory === undefined || root.memory.version !== this.version)
            this.reinitMemory();
        if (root.memory.initTick !== this.cache.initTick)
            this.cache = { initTick: root.memory.initTick, c: {} };
        else {
            const clear = root.memory.clearCache[tracker.currentNodeId];
            _.forOwn(clear, (_e, key) => delete this.cache.c[key]);
            root.memory.clearCache[tracker.currentNodeId] = undefined;
            if (Game.time % 10 === 0) {
                _.forOwn(root.memory.clearCache, (_e, key) => {
                    if (!_.has(tracker.activeNodes, key))
                        delete root.memory.clearCache[key];
                });
            }
            _.forOwn(this.cache, (e, key) => {
                const id = Number(key);
                const metadata = root.memory.metadata[id];
                if (metadata === undefined)
                    delete this.cache.c[id];
                else
                    e.metadata = metadata;
            });
        }
        _.forOwn(root.memory.buffer, (buffer, key) => {
            if (buffer === undefined)
                return;
            const id = Number(key);
            const metadata = root.memory.metadata[id];
            if (metadata === undefined)
                return;
            const cache = this.cache.c[id];
            if (cache === undefined || cache.version < buffer.version) {
                this.cache.c[id] =
                    {
                        d: buffer.d,
                        metadata,
                        version: buffer.version,
                    };
            }
            if (metadata.savedVersion === buffer.version && (Game.time - buffer.lastWrite) > this.clearDelay) {
                delete root.memory.buffer[id];
            }
        });
    }
    afterTick() {
        _.forOwn(this.cache.c, (cache, key) => {
            if (cache.version <= cache.metadata.savedVersion)
                return;
            const id = Number(key);
            let writeFailed;
            if (segmentWrapper.saveSegment(id, cache.d)) {
                cache.metadata.savedVersion = cache.version;
                cache.metadata.lastWrite = Game.time;
                cache.metadata.writeCount++;
                writeFailed = false;
            }
            else {
                cache.metadata.lastWriteRequest = Game.time;
                cache.metadata.writeRequestCount++;
                writeFailed = true;
            }
            if (writeFailed) {
                root.memory.buffer[id] =
                    {
                        d: cache.d,
                        version: cache.version,
                        lastWrite: Game.time,
                    };
            }
        });
        let bufferSize = _.sum(root.memory.buffer, (b) => b.d.length);
        if (bufferSize > this.maxBufferSize) {
            _.forOwn(root.memory.buffer, (buffer, key) => {
                if (buffer === undefined)
                    return;
                const id = Number(key);
                const metadata = root.memory.metadata[id];
                if (metadata === undefined)
                    return;
                if (metadata.savedVersion === buffer.version) {
                    bufferSize -= buffer.d.length;
                    delete root.memory.buffer[id];
                }
                if (bufferSize <= this.maxBufferSize)
                    return false;
                return;
            });
            if (bufferSize > this.maxBufferSize) {
                exports.log.error(`segments.buffer: failed to trim memory buffer to ${this.maxBufferSize}, overhead: ${bufferSize - this.maxBufferSize}`);
                _.forOwn(root.memory.buffer, (buffer, key) => {
                    if (buffer === undefined)
                        return;
                    const id = Number(key);
                    exports.log.error(`segments.buffer: dropping data in segment ${id}, freeing ${buffer.d.length}`);
                    bufferSize -= buffer.d.length;
                    delete root.memory.buffer[id];
                    delete root.memory.metadata[id];
                    delete this.cache.c[id];
                    if (bufferSize <= this.maxBufferSize)
                        return false;
                    return;
                });
            }
        }
        segmentWrapper.afterTick();
    }
    getOrCreateMetadata(id) {
        let metadata = root.memory.metadata[id];
        if (metadata === undefined) {
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
    getUsedSegments() {
        return Object.keys(root.memory.metadata).map(Number);
    }
    get(id) {
        const metadata = root.memory.metadata[id];
        if (metadata === undefined)
            return { status: exports.eSegmentBufferStatus.Empty };
        metadata.getCount++;
        const cache = this.cache.c[id];
        if (cache !== undefined && cache.version >= metadata.savedVersion)
            return { status: exports.eSegmentBufferStatus.Ready, data: cache.d };
        metadata.cacheMiss++;
        const data = segmentWrapper.getSegment(id);
        if (data !== undefined) {
            metadata.readCount++;
            metadata.lastRead = Game.time;
            const entry = {
                d: data,
                metadata,
                version: metadata.savedVersion,
            };
            this.cache.c[id] = entry;
            root.memory.buffer[id] =
                {
                    d: entry.d,
                    version: entry.version,
                    lastWrite: Game.time,
                };
            return { status: exports.eSegmentBufferStatus.Ready, data };
        }
        metadata.readRequestCount++;
        metadata.lastReadRequest = Game.time;
        if (segmentWrapper.requestSegment(id))
            return { status: exports.eSegmentBufferStatus.NextTick };
        return { status: exports.eSegmentBufferStatus.Delayed };
    }
    set(id, data) {
        exports.log.info(`SegmentBuffer: setting ${id}`);
        const cache = this.cache.c[id];
        if (cache !== undefined) {
            cache.d = data;
            cache.version++;
            cache.metadata.setCount++;
            return;
        }
        const metadata = this.getOrCreateMetadata(id);
        this.cache.c[id] =
            {
                d: data,
                version: metadata.savedVersion + 1,
                metadata,
            };
        metadata.setCount++;
    }
    clear(id) {
        delete this.cache.c[id];
        delete root.memory.buffer[id];
        delete root.memory.metadata[id];
        const nodes = tracker.activeNodes;
        _.keys(nodes).forEach((nodeId) => {
            if (nodeId === tracker.currentNodeId)
                return;
            if (root.memory.clearCache[nodeId] === undefined)
                root.memory.clearCache[nodeId] = { [id]: 1 };
            else
                root.memory.clearCache[nodeId][id] = 1;
        });
    }
    visualize(scale) {
        const states = {
            inCache: {
                cell: () => new Text("B", { color: "blue" }),
                pos: { column: 2, row: 2 },
            },
            inBuffer: {
                cell: () => new Text("C", { color: "red" }),
                pos: { column: 1, row: 2 },
            },
            savedVersion: {
                cell: (text) => new Text(text, { color: "green" }),
                pos: { column: 0, row: 3 },
            },
            inBufferVersion: {
                cell: (text) => new Text(text, { color: "red" }),
                pos: { column: 1, row: 3 },
            },
            inCacheVersion: {
                cell: (text) => new Text(text, { color: "blue" }),
                pos: { column: 2, row: 3 },
            },
            cacheMiss: {
                cell: (text) => new Text(text, { color: "red" }),
                pos: { column: 2, row: 4 },
            },
        };
        const grid = segmentWrapper.makeGrid({ columns: 3, rows: 5 });
        for (let id = 0; id < 100; id++) {
            const cell = grid.getCellByIndex(id);
            const cache = this.cache.c[id];
            if (cache !== undefined) {
                cell.setCell(states.inCache.pos, states.inCache.cell());
                cell.setCell(states.inCacheVersion.pos, states.inCacheVersion.cell(`${cache.version}`));
            }
            const buffer = root.memory.buffer[id];
            if (buffer !== undefined) {
                cell.setCell(states.inBuffer.pos, states.inBuffer.cell());
                cell.setCell(states.inBufferVersion.pos, states.inBufferVersion.cell(`${buffer.version}`));
            }
            const md = root.memory.metadata[id];
            if (md !== undefined) {
                cell.setCell(states.savedVersion.pos, states.savedVersion.cell(`${md.savedVersion}`));
                cell.setCell(states.cacheMiss.pos, states.cacheMiss.cell(`${md.cacheMiss}`));
            }
        }
        grid.box = { x: () => -0.5, y: () => -0.5, w: () => 50, h: () => grid.rows * 2 * scale };
        grid.draw(new RoomVisual());
    }
    forgetAll() {
        this.reinitMemory();
        this.cache = { initTick: Game.time, c: {} };
    }
}
const segmentBuffer = new SegmentBuffer();

const root$2 = {
    get memory() { return Memory.storage; },
    set memory(value) { Memory.storage = value; },
    path: "Memory.storage",
};
class SegmentStringStorage {
    constructor() {
        this.version = 0;
        this.cache = { initTick: Game.time, c: {} };
        this.availableSegments = _.range(0, 100);
    }
    get memory() { return root$2.memory; }
    reinitMemory() {
        root$2.memory =
            {
                version: this.version,
                initTick: Game.time,
                m: {},
                clearCache: {},
            };
    }
    reset() {
        segmentBuffer.reset();
        this.reinitMemory();
    }
    beforeTick() {
        segmentBuffer.beforeTick();
        if (root$2.memory === undefined || root$2.memory.version !== this.version)
            this.reinitMemory();
        if (root$2.memory.initTick !== this.cache.initTick)
            this.cache = { initTick: root$2.memory.initTick, c: {} };
        else {
            const clear = root$2.memory.clearCache[tracker.currentNodeId];
            _.forOwn(clear, (_e, key) => delete this.cache.c[key]);
            root$2.memory.clearCache[tracker.currentNodeId] = undefined;
            if (Game.time % 10 === 0) {
                _.forOwn(root$2.memory.clearCache, (_e, key) => {
                    if (!_.has(tracker.activeNodes, key))
                        delete root$2.memory.clearCache[key];
                });
            }
            _.forOwn(this.cache, (e, key) => {
                const id = Number(key);
                const metadata = root$2.memory.m[id];
                if (metadata === undefined)
                    delete this.cache.c[id];
                else
                    e.metadata = metadata;
            });
        }
    }
    afterTick() {
        const freeSegments = _.difference(this.availableSegments, segmentBuffer.getUsedSegments());
        const maxSize = segmentBuffer.maxSize;
        _.forOwn(this.cache.c, (cache, label) => {
            if (cache.v <= cache.metadata.v)
                return;
            if (cache.data === undefined)
                return;
            cache.metadata.ids.forEach((id) => segmentBuffer.clear(id));
            if (cache.data.length <= maxSize) {
                const id = freeSegments.pop();
                if (id === undefined)
                    exports.log.error(`SegmentStringStorage: run out of segments, dropping data: '${label}'`);
                else {
                    segmentBuffer.set(id, cache.data);
                    cache.metadata.ids = [id];
                    cache.metadata.v = cache.v;
                }
                return;
            }
            const parts = [];
            let start = 0;
            while (start < cache.data.length) {
                const remaining = cache.data.length - start;
                const end = start + Math.min(remaining, maxSize);
                parts.push(cache.data.slice(start, end));
                start = end;
            }
            if (freeSegments.length < parts.length) {
                exports.log.error(`SegmentStringStorage: run out of segments, dropping data: '${label}'`);
                return;
            }
            cache.metadata.ids = [];
            parts.map((part) => {
                const id = freeSegments.pop();
                if (id !== undefined) {
                    segmentBuffer.set(id, part);
                    cache.metadata.ids.push(id);
                    cache.metadata.v = cache.v;
                }
            });
        });
        segmentBuffer.afterTick();
        return freeSegments;
    }
    set(label, data) {
        const cache = this.cache.c[label];
        if (cache !== undefined) {
            exports.log.error(`new data for '${label}'`);
            cache.v++;
            cache.data = data;
            return;
        }
        let metadata = root$2.memory.m[label];
        if (metadata === undefined) {
            exports.log.error(`new '${label}'`);
            metadata = { v: -1, ids: [] };
            root$2.memory.m[label] = metadata;
        }
        this.cache.c[label] =
            {
                v: metadata.v + 1,
                data,
                metadata,
            };
    }
    get(label) {
        const metadata = root$2.memory.m[label];
        if (metadata === undefined)
            return { status: exports.eSegmentBufferStatus.Empty };
        const cache = this.cache.c[label];
        if (cache !== undefined && cache.v >= metadata.v)
            return { status: exports.eSegmentBufferStatus.Ready, data: cache.data };
        const segments = metadata.ids.map(segmentBuffer.get, segmentBuffer);
        const parts = [];
        let status = exports.eSegmentBufferStatus.Ready;
        for (const entry of segments) {
            if (entry.status > status)
                status = entry.status;
            if (status === exports.eSegmentBufferStatus.Ready && entry.data !== undefined)
                parts.push(entry.data);
        }
        if (status === exports.eSegmentBufferStatus.Ready && parts.length === segments.length) {
            const cache = {
                v: metadata.v,
                data: parts.join(""),
                metadata,
            };
            this.cache.c[label] = cache;
            return { status: exports.eSegmentBufferStatus.Ready, data: cache.data };
        }
        if (parts.length >= 0)
            return { status, partial: parts.join("") };
        return { status };
    }
    clear(label) {
        delete this.cache.c[label];
        const metadata = root$2.memory.m[label];
        if (metadata === undefined)
            return;
        metadata.ids.forEach((id) => segmentBuffer.clear(id));
        const nodes = tracker.activeNodes;
        _.keys(nodes).forEach((nodeId) => {
            if (nodeId === tracker.currentNodeId)
                return;
            if (root$2.memory.clearCache[nodeId] === undefined)
                root$2.memory.clearCache[nodeId] = { [label]: 1 };
            else
                root$2.memory.clearCache[nodeId][label] = 1;
        });
        delete root$2.memory.m[label];
    }
    visualize(scale) {
        segmentBuffer.visualize(scale);
    }
}
const segmentStorage = new SegmentStringStorage();

exports.SegmentBuffer = SegmentBuffer;
exports.segmentBuffer = segmentBuffer;
exports.SegmentsBasicWrapper = SegmentsBasicWrapper;
exports.segmentWrapper = segmentWrapper;
exports.SegmentStringStorage = SegmentStringStorage;
exports.segmentStorage = segmentStorage;
exports.Circle = Circle;
exports.Rect = Rect;
exports.Text = Text;
exports.Grid = Grid;
exports.setLogger = setLogger;
exports.RuntimeTracker = RuntimeTracker;
exports.tracker = tracker;
//# sourceMappingURL=lib.js.map
