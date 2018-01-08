export interface ILogger
{
	error(message: string): void;
	info(message: string): void;
}

class Logger implements ILogger
{
	public error(message: string)
	{
		console.log(message);
	}

	public info(message: string)
	{
		console.log(message);
	}
}

export let log: ILogger = new Logger();

export function setLogger(_log: ILogger)
{
	log = _log;
}
