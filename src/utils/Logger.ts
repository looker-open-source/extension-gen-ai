/**
 * Copyright (c) 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

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
