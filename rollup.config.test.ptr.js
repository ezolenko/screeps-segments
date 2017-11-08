import config from "./rollup.config.test"
import screepsUpload from "./rollup/rollup-plugin-screeps-upload";

config.plugins.push(screepsUpload("./.screeps.config.json"));

export default config;
