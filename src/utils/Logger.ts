import { UtilsHelper } from "./Helper";

export enum LoggerLevelEnum {
    Trace,
    Debug,
    Info,
    Warn,
    Error
}

export class Logger {
    private static minLevel: LoggerLevelEnum;

    public static setLoggerLevelByNumber(levelIndex: number){
        const levels: string[] = UtilsHelper.enumToArray(LoggerLevelEnum);
        const level: unknown = levels[levelIndex];
        if (!level) {
            throw new Error('invalid log level');
        }
        this.minLevel = level as LoggerLevelEnum;
    }

    public static setLoggerLevel(levelName: LoggerLevelEnum){
        this.minLevel = levelName;
    }

    public static setLoggerLevelByName(levelName: string){
        const levels: string[] = UtilsHelper.enumToArray(LoggerLevelEnum);
        const levelIndex = levels.findIndex((level) =>
            level.toLowerCase() === levelName.toLowerCase());
        if (levelIndex === -1) {
            throw new Error('invalid log level name');
        }
        this.minLevel = levelIndex;
    }
    /**
     * Central logging method.
     * @param logLevel 
     * @param message 
     */
    private static writeLog(level: LoggerLevelEnum, message: any, ...optionalParams: any[]): void {
        if (level < this.minLevel) {
            return;
        }
        const levelName: string = LoggerLevelEnum[level];
        const standardOutputHandlerMap: {
            [key in LoggerLevelEnum]: (message?: any, ...optionalParams: any[]) => void
        } = {
            [LoggerLevelEnum.Trace]: console.trace,
            [LoggerLevelEnum.Debug]: console.debug,
            [LoggerLevelEnum.Info]: console.info,
            [LoggerLevelEnum.Warn]: console.warn,
            [LoggerLevelEnum.Error]: console.error,
        }
        const standardOutputHandler = standardOutputHandlerMap[level];
        standardOutputHandler(`${levelName}\t`, message, ...optionalParams)
    }

    public static trace(message: any, ...optionalParams: any[]): void { this.writeLog(LoggerLevelEnum.Trace, message, ...optionalParams); }
    public static debug(message: any, ...optionalParams: any[]): void { this.writeLog(LoggerLevelEnum.Debug, message, ...optionalParams); }
    public static info(message: any, ...optionalParams: any[]): void  { this.writeLog(LoggerLevelEnum.Info, message, ...optionalParams); }
    public static warn(message: any, ...optionalParams: any[]): void  { this.writeLog(LoggerLevelEnum.Warn, message, ...optionalParams); }
    public static error(message: any, ...optionalParams: any[]): void { this.writeLog(LoggerLevelEnum.Error, message, ...optionalParams); }
  }
