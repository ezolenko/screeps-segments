class Logger implements ILogger
{
	public error(message: string)
	{
		console.log(message);
	}
}

export const logger: ILogger = new Logger();
