import { ScreepsAPI } from "screeps-api";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import * as git from "git-rev-sync";

const readFile = promisify(fs.readFile);
const readDir = promisify(fs.readdir);

async function upload(configFile, bundleFile)
{
	if (configFile === undefined)
		return;
	try
	{
		const api = new ScreepsAPI();
		const auth = readFile(configFile, "utf-8").then((data) => api.setServer(JSON.parse(data))).then(() => api.auth());
		const branch = async () => `${git.remoteUrl().replace(/.*[/]/, "")}-${git.branch()}`;

		const root = path.dirname(bundleFile);
		const jsFiles = readDir(root, "utf-8").then((files) => files.filter((f) => f.endsWith(".js")));

		const code = {};
		const loadCode = Promise.all((await jsFiles).map(async (e) =>
		{
			const name = await e;
			code[name.replace(/\.js$/i, "")] = await readFile(path.join(root, name), "utf-8")
		}));

		await auth;
		const branches = await api.raw.user.branches().then((data) => data.list.map((b) => b.branch));
		const newBranch = await branch();
		await loadCode;

		console.log(`screeps-upload:\n\thost: ${api.opts.url}\n\tbranch: ${newBranch}\n\tfiles:\n\t\t${Object.keys(code).join("\n\t\t")}`);

		if (branches.includes(newBranch))
			await api.code.set(newBranch, code);
		else
			await api.raw.user.cloneBranch("", newBranch, code);
	}
	catch(err)
	{
		console.log(`screeps-upload: failed -- ${err.stack}`);
	}
}

function getConfigName()
{
	const index = process.argv.indexOf("--screeps");
	if (index > 0)
		return process.argv[index + 1];
	return undefined;
}

export default function screepsUpload(configFile)
{
	return {
		name: "screeps-upload",

		onwrite({ file })
		{
			Promise.resolve(upload(configFile === undefined ? getConfigName() : configFile, file));
		},
	};
}