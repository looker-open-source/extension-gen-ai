export class Logger {

    private static instance: Logger;    
    public readonly levels: { [key: string]: number } = {
        'trace': 1,
        'debug': 2,
        'info': 3,
        'warn': 4,
        'error': 5
    };
    private logLevel: number = 3;    
  
    private constructor() {
        
    }
  
    static getInstance() {
      if (Logger.instance) {
        return this.instance;
      }
      this.instance = new Logger();
      return this.instance;
    }

    public static setLogLevel(logLevel: number){
        this.getInstance().logLevel = logLevel;
    }

    public static getLogLevel()
    {
        return this.getInstance().logLevel;
    }

    /**
     * Converts a string level (trace/debug/info/warn/error) into a number 
     * 
     * @param minLevel 
     */
    public levelToInt(minLevel: string): number {
        if (minLevel.toLowerCase() in this.levels)
            return this.levels[minLevel.toLowerCase()];
        else
            return 99;
    }

    /**
     * Central logging method.
     * @param logLevel 
     * @param message 
     */
    public log(logLevel: string, message: any, ...optionalParams: any[]): void {
        const level = this.levelToInt(logLevel);
        if (level < Logger.getInstance().logLevel) return;                                 
        console.log(logLevel + "=> ",message, ...optionalParams);                        
    }

    public trace(message: any, ...optionalParams: any[]): void { this.log('trace', message, ...optionalParams); }
    public debug(message: any, ...optionalParams: any[]): void { this.log('debug', message, ...optionalParams); }
    public info(message: any, ...optionalParams: any[]): void  { this.log('info', message, ...optionalParams); }
    public warn(message: any, ...optionalParams: any[]): void  { this.log('warn', message, ...optionalParams); }
    public error(message: any, ...optionalParams: any[]): void { this.log('error', message, ...optionalParams); }


  }