import ts from "rollup-plugin-typescript2";
import nodeResolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import fileSize from "rollup-plugin-filesize";
import sourcemaps from "rollup-plugin-sourcemaps";
import screepsSourcemap from "./rollup/rollup-plugin-screeps-sourcemap";
import screepsVsc from "./rollup/rollup-plugin-screeps-vsc";
import screepsUpload from "rollup-plugin-screeps-upload";

export default {
	sourcemap: true,

	plugins:
	[
		screepsVsc(),
		sourcemaps(),
		ts({ verbosity: 2 }),
		nodeResolve({ jsnext: true, main: true }),
		commonjs({ ignoreGlobal: true, include: "node_modules/**" }),
		fileSize(),
		screepsSourcemap(),
		screepsUpload(),
	],

	banner: "/* eslint-disable */",
};
