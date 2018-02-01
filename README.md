# screeps-segments

Yet another segment management library. 

(somewhat influenced by tedivm's original sos_lib_segments.js)

- Eliminates contention issues when requesting and committing segments. (`segmentWrapper`)
- Provides segment-level caching with cache propagation to runtimes, buffered writing and access stats. (`segmentBuffer`)
- Provides key-value data access, splitting data over multiple segments, but doesn't support packing multiple values into one segment yet. (`segmentStorage`)
- A test harness adapted for screeps runtime is thrown in as a bonus (will move out into own repo eventually).

## Requirements

All segment access muct be done through the library. Use `segmentWrapper` if direct unbuffered access is needed.

## Running tests

Run `npm run build-test`, upload `dist/test/*.js` to a server with a decent tick rate. Check the visuals and console output for results. Execute `restartTest()` in console to start over.

## Integration

```typescript
// main.ts

import { segmentStorage, tracker, setLogger } from "screeps-segments";

// swap for your own logger if you have any
const logger = 
{
	error(message: string): void { console.log(message); },
	info(message: string): void { console.log(message); },
};

setLogger(logger);

export function loop()
{
	tracker.beforeTick(); // runtime node tracker, used 
	segmentStorage.beforeTick();
  
	// the rest of the loop here
  
	segmentStorage.afterTick();
	tracker.afterTick();
}
```

## Usage

See public interfaces for `segmentStorage`, `segmentBuffer` and `segmentWrapper`, they are basically straightforward. Storage uses buffer, which in turn uses wrapper. So you can deal only with storage unless you need lower level access specifically.

```typescript

segmentStorage.set("label1", "data");

const res = segmentStorage.get("label2");
if (res.status === eSegmentBufferStatus.Empty)
	console.log("not found");
if (res.status === eSegmentBufferStatus.Ready)
	console.log("ready:", res.data);
if (res.status === eSegmentBufferStatus.NextTick)
	console.log("data is expected to be ready on the next tick");
if (res.status === eSegmentBufferStatus.Delayed)
	console.log("are we there yet?");
	
segmentStorage.clear("label3");

const ids = segmentStorage.getIds("label4"); 
// in case you need to know which segments data is written in (for example to integrate with screeps-stats-lib). 
// Can be undefined for several ticks before write comes through.

```
