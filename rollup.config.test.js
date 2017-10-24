import config from "./rollup.config.base"

config.input = "test/main.ts";

config.output = [{ format: "cjs", file: "dist/test/main.js" }];

export default config;
