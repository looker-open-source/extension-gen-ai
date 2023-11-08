/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { Looker40SDK } from "@looker/sdk";
import { LookerSQLService } from "./LookerSQLService";
import { Logger } from "../utils/Logger";

export interface ISettings {
    logLevel: string;
    customPrompt: string;
}



export class ConfigReader {
    public static readonly CURRENT_VERSION = "1.7";
    public static readonly LAST_UPDATED = "11/08/2023";
    public static readonly BQML_MODEL = "llm.llm_model";
    public static readonly EXPLORE_LOGGING = "llm.explore_logging";
    public static readonly SETTINGS_TABLE = "llm.settings";
    public static readonly DEFAULT_USER_ID = "defaultUser";

    private sql: LookerSQLService;
    public userId: string;
    private lookerSDK: Looker40SDK;

    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
        this.userId = ConfigReader.DEFAULT_USER_ID;
        this.lookerSDK = lookerSDK;
    }

    /**
     * Set User ID from looker SDK
     * @param lookerSDK 
     * @returns 
     */
    public async setUserId()
    {
        const response = await this.lookerSDK.me();
        if(response.ok)
        {
            this.userId = response.value.id!;
        }
        else{
            Logger.error("Error getting user id");
        }        
    }

    public async getSettings():Promise<ISettings>
    {   
        await this.setUserId();        
        const queryToRun = `#Looker GenAI Extension - version: ${ConfigReader.CURRENT_VERSION} - getConfig
SELECT JSON_VALUE(settings[0]["logLevel"]) as logLevel,
JSON_VALUE(settings[0]["customPrompt"]) as customPrompt
FROM ${ConfigReader.SETTINGS_TABLE} WHERE userId = "${this.userId}" OR userId IS NULL ORDER BY COALESCE(userId,"-1") DESC LIMIT 1`;
        const results = await this.sql.execute<ISettings>(queryToRun);                 
        return results[0];
    }

    /**
     * Update the settings for the current user
     * @param updatedSettings 
     * @returns 
     */
    public async updateSettings(updatedSettings:ISettings)
    {
        await this.setUserId();   
        const queryToRun = `#Looker GenAI Extension - version: ${ConfigReader.CURRENT_VERSION} - updateUserSettings
BEGIN
DELETE FROM ${ConfigReader.SETTINGS_TABLE} WHERE userId = "${this.userId}";
INSERT INTO ${ConfigReader.SETTINGS_TABLE} (config, userId)
VALUES(JSON_OBJECT('logLevel', "${updatedSettings.logLevel}", 'customPrompt', ${updatedSettings.customPrompt}), "${this.userId}");
END`;        
        const results = await this.sql.executeLog(queryToRun);
        Logger.debug("Updated settings: "+ results);                                
    }  

    public async resetDefaultSettings()
    {
        await this.setUserId();   
        const queryToRun = `#Looker GenAI Extension - version: ${ConfigReader.CURRENT_VERSION} - resetUserSettings
DELETE FROM ${ConfigReader.SETTINGS_TABLE}         
WHERE userId = "${this.userId}"`;        
        const results = await this.sql.executeLog(queryToRun);
        Logger.debug("Reset  settings: "+ results);                                                
    }

}   
