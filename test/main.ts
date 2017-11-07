import "./segments.basic.wrapper.test";
import "./segments.buffer.test";
import { runAllTests } from "../harness/runner";
import { sourceMap } from "../harness/sourcemap";

export const LOG_VSC = { repo: "$repo", revision: "$revision", valid: "$revValid", revCount: "$revCount", branch: "$branch" };

sourceMap.setVscInfo(LOG_VSC);

export function loop()
{
	runAllTests(sourceMap);
}
