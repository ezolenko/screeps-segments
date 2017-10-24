import ts from "rollup-plugin-typescript2";
import nodeResolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import cleanup from "rollup-plugin-cleanup";
import fileSize from "rollup-plugin-filesize";

export default {
	sourcemap: false,

	plugins: [
		ts({ verbosity: 2 }),
		nodeResolve({ jsnext: true, main: true }),
		commonjs({ ignoreGlobal: true, include: "node_modules/**" }),
		cleanup(),
		fileSize(),
	],

	banner: "/* eslint-disable */",
};
