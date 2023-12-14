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
import { PromptTemplateService, PromptTemplateTypeEnum } from "./PromptTemplateService";
import { ISettings } from "../@types/settings";




export class ConfigReader {
    public static readonly CURRENT_VERSION = "2.6";
    public static readonly LAST_UPDATED = "14/06/2023";
    public static readonly BQML_MODEL = "llm.llm_model";
    public static readonly EXPLORE_LOGGING = "llm.explore_logging";
    public static readonly SETTINGS_TABLE = "llm.settings";
    public static readonly EXPLORE_MODELS = "llm.looker_explores";
    public static readonly DEFAULT_USER_ID = "defaultUser";
    public static readonly DEFAULT_MODEL_SIZE = "32";

    private sql: LookerSQLService;
    private lookerSDK: Looker40SDK;
    private promptService: PromptTemplateService;

    /**
     * 
     * @param lookerSDK 
     */

    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
        this.lookerSDK = lookerSDK;
        this.promptService = new PromptTemplateService();
    }


    public async getSettings(userId: string):Promise<ISettings>
    {   
        try
        {        
            const queryToRun = `#Looker GenAI Extension - version: ${ConfigReader.CURRENT_VERSION} - getConfig
    SELECT "${userId}" as userId,
    COALESCE(JSON_VALUE(config["logLevel"]), "info") as logLevel,
    COALESCE(JSON_VALUE(config["llmModelSize"]), "${ConfigReader.DEFAULT_MODEL_SIZE}") as llmModelSize,
    JSON_VALUE(config["customPrompt"]) as customPrompt,
    COALESCE(userId, "-1") as priority, 
    COALESCE(JSON_VALUE(config["useNativeBQ"]), "true") as useNativeBQ
    FROM ${ConfigReader.SETTINGS_TABLE} WHERE userId = "${userId}" OR userId IS NULL ORDER BY priority DESC LIMIT 1`;
            const results = await this.sql.execute<ISettings>(queryToRun);                         
            return results[0];
        }
        catch(err){
            Logger.error("Could not get custom settings from BigQuery, make sure the table and data exists in the tableReference llm.settings, loading default: "+ err);
            return {userId: userId, logLevel: "info", useNativeBQ: "true", llmModelSize: ConfigReader.DEFAULT_MODEL_SIZE, customPrompt: this.promptService.getByType(PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS)};            
        }
    }

    /**
     * Update the settings for the current user
     * @param updatedSettings 
     * @returns 
     */
    public async updateSettings(updatedSettings:ISettings, userId: string)
    {
        try{
            const queryToRun = `#Looker ExtGenAI updateUserSettings - v: ${ConfigReader.CURRENT_VERSION}
            BEGIN
            DELETE FROM ${ConfigReader.SETTINGS_TABLE} WHERE userId = "${userId}";
            INSERT INTO ${ConfigReader.SETTINGS_TABLE} (config, userId)
            VALUES(JSON_OBJECT('logLevel', "${updatedSettings.logLevel}", 'llmModelSize', "${updatedSettings.llmModelSize}",
            'useNativeBQ', ${updatedSettings.useNativeBQ}, 'customPrompt', """${updatedSettings.customPrompt}"""), "${userId}");
            END`;        
            const results = await this.sql.executeLog(queryToRun);
            Logger.info("Settings saved sucessfully: "+ results);             
        }
        catch(err)
        {
            Logger.error("Failed to persist user preferences on BigQuery - working only during the session");
        }
        
    }  

    public async resetDefaultSettings(userId: string)
    {
        try{
            const queryToRun = `#Looker ExtGenAI resetUserSettings - v: ${ConfigReader.CURRENT_VERSION} 
            DELETE FROM ${ConfigReader.SETTINGS_TABLE}         
            WHERE userId = "${userId}"`;        
            const results = await this.sql.executeLog(queryToRun);
            Logger.debug("Reset  settings: "+ results);                                                
        }   
        catch(error)
        {
            Logger.error("Could not reset settings on BigQuery");
        }          
    }

}   
