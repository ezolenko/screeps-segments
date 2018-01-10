// import "./segments.basic.wrapper.test";
// import "./segments.buffer.test";
import "./segments.storage.test";

import { runAllTests } from "../harness/runner";
import { sourceMap } from "../harness/sourcemap";

const LOG_VSC = { repo: "$repo", revision: "$revision", valid: "$revValid", revCount: "$revCount", branch: "$branch", buildRoot: "$buildRoot" };
sourceMap.setVscInfo(LOG_VSC);

export function loop()
{
	runAllTests(LOG_VSC.revision, sourceMap);
}
