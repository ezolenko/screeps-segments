import ts from "rollup-plugin-typescript2";
import nodeResolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import cleanup from "rollup-plugin-cleanup";
import fileSize from "rollup-plugin-filesize";
import replace from "rollup-plugin-re";
import sourcemaps from 'rollup-plugin-sourcemaps';
import * as git from "git-rev-sync";

import * as fs from "fs";
import * as path from "path";

export default {
	sourcemap: true,

	plugins: [
		replace
		({
			replaces:
			{
				"$repo": `${git.remoteUrl()}`,
				"$revision": `${git.long()}`,
				"$branch": `${git.branch()}`,
				"$revCount": `${git.count()}`,
				"$revValid": "true",
			},
		}),
		sourcemaps(),
		ts({ verbosity: 2 }),
		nodeResolve({ jsnext: true, main: true }),
		commonjs({ ignoreGlobal: true, include: "node_modules/**" }),
		cleanup(),
		fileSize(),
		{
			name: "screeps-source-map",
			onwrite(bundle)
			{
				const map = `module.exports.d=${bundle.bundle.map}`;
				fs.writeFileSync(path.join(path.dirname(bundle.file), "main.js.map.js"), map);
			}
		},
	],

	banner: "/* eslint-disable */",
};
