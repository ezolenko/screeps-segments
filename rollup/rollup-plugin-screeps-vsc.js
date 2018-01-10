import * as git from "git-rev-sync";
import replace from "rollup-plugin-re";

export default function screepsVsc()
{
	return replace
	({
		replaces:
		{
			"$repo": `${git.remoteUrl()}`,
			"$revision": `${git.long()}`,
			"$branch": `${git.branch()}`,
			"$revCount": `${git.count()}`,
			"$revValid": "true",
			"$buildRoot": "x/x",
		},
	});
}
