interface ISegmentStorageMetadata
{

}

interface ISegmentStorageCache
{
	[label: string]:
	{
		data?: string;
		metadata: ISegmentStorageMetadata;
	};
}

// class SegmentStringStorage
// {
// 	private b: SegmentBuffer;
// 	private cache: ISegmentStorageCache = {};

// 	private get memory() { return Memory.storage; }

// 	constructor(private log: ILogger)
// 	{
// 		this.b = new SegmentBuffer(this.log);
// 	}

// 	public beforeTick()
// 	{
// 		this.b.beforeTick();

// 		_.forOwn(this.cache, (e, key) =>
// 		{
// 			const id = Number(key);

// 			const metadata = this.memory.metadata[id];

// 			// clear cache or restore metadata objects
// 			if (metadata === undefined)
// 				delete this.cache[id];
// 			else
// 				e.metadata = metadata;
// 		});
// 	}

// 	public afterTick()
// 	{
// 		this.b.afterTick();
// 	}

// 	public setString(label: string, data: string)
// 	{

// 	}

// 	private lock(metadata: ISegmentStorageMetadata)
// 	{
// 		if (metadata.locked === undefined)
// 		{
// 			metadata.ids.forEach(this.b.lock, this.b);
// 			metadata.locked = 1;
// 		}
// 	}

// 	private unlock(metadata: ISegmentStorageMetadata)
// 	{
// 		if (metadata.locked !== undefined)
// 		{
// 			metadata.ids.forEach(this.b.unlock, this.b);
// 			metadata.locked = undefined;
// 		}
// 	}

// 	public getString(label: string): string | undefined
// 	{
// 		// if no metadata, doesn't exist
// 		const metadata = this.memory.metadata[label];
// 		if (metadata === undefined)
// 			return undefined;

// 		const cache = this.cache[label];
// 		if (cache === undefined)
// 		{
// 			const segments = metadata.ids.map(this.b.get, this.b);

// 			const entry
// 		}
// 	}
// }

// export const segments = new SegmentStringStorage();
