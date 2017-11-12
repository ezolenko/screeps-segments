import { IMemoryRoot } from "./memory.root";

export interface IRuntimeNode
{
	reuse: number;
	totalReuse: number;
	lastSeen: number;
}

export interface IRuntimeTrackerMemory
{
	lastNode?: string;
	nodes:
	{
		[node: string]: IRuntimeNode;
	};
}

declare global
{
	interface Memory
	{
		__runtime_tracker: IRuntimeTrackerMemory;
	}
}

const root: IMemoryRoot<IRuntimeTrackerMemory> =
{
	get memory(): IRuntimeTrackerMemory { return Memory.__runtime_tracker; },
	set memory(value: IRuntimeTrackerMemory) { Memory.__runtime_tracker = value; },
	path: "Memory.__runtime_tracker",
};

const currentNodeId = String(Game.time);

export class RuntimeTracker
{
	public get isLoadTick() { return root.memory.nodes[this.currentNodeId].totalReuse === 1; }
	public get currentNodeId() { return currentNodeId; }
	public get switchedNodes() { return root.memory.lastNode !== this.currentNodeId; }
	public isActive(nodeId: string) { return _.has(root.memory.nodes, nodeId); }

	private get memory() { return root.memory; }

	public beforeTick()
	{
		// first tick ever
		if (root.memory === undefined)
		{
			root.memory =
			{
				nodes:
				{
					[this.currentNodeId]:
					{
						reuse: 1,
						totalReuse: 1,
						lastSeen: Game.time,
					},
				},
			};
		}
		else
		{
			// first tick on this node
			if (root.memory.nodes[this.currentNodeId] === undefined)
			{
				root.memory.nodes[this.currentNodeId] =
				{
					reuse: 1,
					totalReuse: 1,
					lastSeen: Game.time,
				};
			}
			else // seen this before
			{
				const node = root.memory.nodes[this.currentNodeId];
				node.lastSeen = Game.time;
				node.totalReuse += 1;
				node.reuse += 1;
			}

			_.each(root.memory.nodes, (node, key) =>
			{
				if (key === undefined || key === this.currentNodeId)
					return;
				node.reuse = 0;
				if (Game.time - node.lastSeen > 100)
					delete root.memory.nodes[key];
			});
		}
	}

	private activeNodes()
	{
		const nodes: Array<{ id: string, node: IRuntimeNode, diff: number, p: number }> = _
			.map(root.memory.nodes, (node, id) =>
			{
				return {
					id: id!,
					node,
					diff: 0,
					p: Game.time - node.lastSeen + node.totalReuse,
				};
			})
			.sort((e) => e.p);
		for (let i = 1; i < nodes.length; ++i)
		{
			nodes[i].diff = nodes[i].p / nodes[i - 1].p;
		}
		return nodes.slice(0, _.findIndex(nodes, (e) => e.diff > 1.5)).map((e) => ({ [e.id]: e.node })).reduce(_.merge);
	}

	public report(): string
	{
		const active = this.activeNodes();

		return `T: ${Game.time}, last id: ${root.memory.lastNode}, ${this.switchedNodes ? "switched" : "same node"}\n\t` + _.map(root.memory.nodes, (node, key) =>
		{
			return `${key === this.currentNodeId ? "N" : "n"}${_.has(active, key!) ? "A" : "i"}[id: ${key}, t: ${node.totalReuse}, run: ${node.reuse}, lr: ${Game.time - node.lastSeen}]`;
		}).join("\n\t");
	}

	public afterTick()
	{
		root.memory.lastNode = this.currentNodeId;
	}
}

export const tracker = new RuntimeTracker();
