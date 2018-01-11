export interface IRuntimeNode {
    reuse: number;
    totalReuse: number;
    lastSeen: number;
}
export interface IRuntimeTrackerMemory {
    lastNode?: string;
    nodes: {
        [node: string]: IRuntimeNode;
    };
}
declare global  {
    interface Memory {
        runtimes: IRuntimeTrackerMemory;
    }
}
export declare class RuntimeTracker {
    readonly isLoadTick: boolean;
    readonly currentNodeId: string;
    readonly switchedNodes: boolean;
    isActive(nodeId: string): boolean;
    private _activeNodes;
    readonly activeNodes: {
        [id: string]: IRuntimeNode;
    };
    private readonly memory;
    beforeTick(): void;
    private getActiveNodes();
    report(): string;
    afterTick(): void;
}
export declare const tracker: RuntimeTracker;
export {};
