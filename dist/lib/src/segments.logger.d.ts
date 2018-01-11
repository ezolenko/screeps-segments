export interface ILogger {
    error(message: string): void;
    info(message: string): void;
}
export declare let log: ILogger;
export declare function setLogger(_log: ILogger): void;
