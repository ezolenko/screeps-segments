import * as fs from "fs";
import * as path from "path";

export default function screepsSourcemap()
{
	return {
		name: "screeps-sourcemap",
		onwrite(bundle)
		{
			const map = `module.exports.d=${bundle.bundle.map}`;
			fs.writeFileSync(path.join(path.dirname(bundle.file), "main.js.map.js"), map);
		}
	}
}
