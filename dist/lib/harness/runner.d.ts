import { IScreepsTest } from "./test";
import { SourceMapWrapper } from "./sourcemap";
declare global  {
    interface Global {
        testRegistry: Array<{
            constructor: new (sourceMap: SourceMapWrapper) => IScreepsTest;
            order: number;
        }>;
        restartTest(): void;
        wipeMemory(): void;
    }
}
export declare function runAllTests(codeId: string, sourceMap: SourceMapWrapper): boolean;
export declare function TestDefinition(order: number): (constructor: new (sourceMap: SourceMapWrapper) => IScreepsTest) => void;
