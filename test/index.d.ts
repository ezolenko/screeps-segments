interface IRawSegmentTestMemory
{
	start?: number;
	clearStart?: number;
	checked?: { [id: number]: boolean };
}

interface ITestMemory
{
	raw: IRawSegmentTestMemory;
}

interface Memory
{
	__test: ITestMemory;
}
