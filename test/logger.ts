export class Logger implements ILogger
{
	public error(message: string)
	{
		console.log(message);
	}
}
