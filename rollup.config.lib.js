import config from "./rollup.config.base"

const pkg = require("./package.json");

config.input = "./lib/lib.ts";
config.output = [ { format: "cjs", file: pkg.main } ];

export default config;
