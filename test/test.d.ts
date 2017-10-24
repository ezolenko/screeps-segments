interface IRawSegmentTestMemory
{
	start: number;
}

interface ITestMemory
{
	raw: IRawSegmentTestMemory;
}

interface Memory
{
	__test: ITestMemory;
}
