import { ScreepsAPI } from "screeps-api";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import * as git from "git-rev-sync";

const readFile = promisify(fs.readFile);
const readDir = promisify(fs.readdir);

async function upload(configFile, bundleFile)
{
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

		console.log(`uploading ${Object.keys(code).join(", ")} to ${newBranch}`);

		if (branches.includes(newBranch))
			await api.code.set(newBranch, code);
		else
			await api.raw.user.cloneBranch("", newBranch, code);
	}
	catch(err)
	{
		console.log(`failed screeps upload: ${err.stack}`);
	}
}

export default function screepsUpload(configFile)
{
	return {
		name: "screeps-upload",

		onwrite({ file })
		{
			Promise.resolve(upload(configFile, file));
		}
	};
}