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

import { IDashboard, IDashboardBase, IDashboardElement, Looker40SDK } from "@looker/sdk";
import { UtilsHelper } from "../utils/Helper";
import { DashboardTile, LookerDashboardService } from "./LookerDashboardService";
import { LookerSQLService } from "./LookerSQLService";
import { PromptTemplateService, PromptTemplateTypeEnum } from "./PromptTemplateService";
import { Logger } from "../utils/Logger"
import { ConfigReader } from "./ConfigReader";



export class DashboardService {
    private sql: LookerSQLService;
    private dashboardService: LookerDashboardService;    
    private promptService: PromptTemplateService|null = null;

    public constructor(lookerSDK: Looker40SDK)
    {
        this.sql = new LookerSQLService(lookerSDK);
        this.dashboardService = new LookerDashboardService(lookerSDK, this.sql);                
    }
    
    static readonly MAX_CHAR_PER_PROMPT: number = 54000;
    static readonly MAX_CHAR_PER_TILE: number = 54000;
    static readonly MIN_SUMMARIZE_CHAR_PER_TILE: number = 24000;

    /**
     * Lists all available dashboards
     * @returns
     */
    public async listAll(): Promise<IDashboardBase[]> {
        return this.dashboardService.listAll();
    }

    /**
     * Method that gets the current PromptService - Lazy load
     * @returns 
     */
    public getPromptService(): PromptTemplateService
    {
        if(this.promptService==null)
        {
            this.promptService = new PromptTemplateService();
        }
        return this.promptService;
    }


    /**
     * Get Dashboard Elements using dashboardId
     * @param dashboardId 
     * @returns 
     */    
    public async getDashboardDataById<ElementData>(dashboardId: string): Promise<{
        title?: string,
        description?: string,
        elements: Array<DashboardTile<ElementData>>
            }> {
        const dashboard: IDashboard = await this.dashboardService.getById(dashboardId);
        if (!dashboard.dashboard_elements) {
        throw new Error('invalid dashboard element fetch result');
        }
        const elements: IDashboardElement[] = dashboard.dashboard_elements;
        if (elements.length === 0) {
        throw new Error('dashboard does not contain any elements');
        }
        // Debug:        
        // Logger.debug("Dashboard Elements: " + JSON.stringify(elements, null, 2));
        const elementsData: Array<DashboardTile<ElementData>> = await this.dashboardService.mapElementData<ElementData>(elements);

        const { title, description } = dashboard;        
        return {
        title:title!,
        description: description!,
        elements: elementsData,
        };
    }

    public static getSizePerArrayOfTiles(tiles: Array<DashboardTile<unknown>>):number {        
        let size = 0;
        tiles.map(tile => {
            size += JSON.stringify(tile.data).length;            
        });
        Logger.debug("size of array: " + size);
        return size;
    }

    private breakTilesIntoBatches(dashboardElementData:
        {
            title?: string,
            description?: string,
            elements: Array<DashboardTile<unknown>>
        }):Array<Array<DashboardTile<unknown>>>
    {    
        
        const arrayBatchesOfDash:Array<Array<DashboardTile<unknown>>> = [];   
        // Logic to break the dashboard tiles into batches following the max size of tokens per LLM response        
        for (const element of dashboardElementData.elements) {
            // Data Length
            const tileLength = JSON.stringify(element.data).length;
            // Needs to check if a single tile exceeds the number of elements, if so, consider 
            // TODO: in the future get the png and send multimodal prompt
            if (tileLength > DashboardService.MAX_CHAR_PER_PROMPT)
            {
                Logger.debug("Tile data is too large. Ignoring this tile: " + element.title + "length: " + tileLength + " > " + DashboardService.MAX_CHAR_PER_PROMPT)
                break;
            }
            let needsToAddElement = true;
            for(const batchOfDash of arrayBatchesOfDash)
            {
                const lengthArrayOfTiles = DashboardService.getSizePerArrayOfTiles(batchOfDash);
                // Simple logic to fill the batches sequentially
                if((lengthArrayOfTiles + tileLength) < DashboardService.MAX_CHAR_PER_PROMPT)
                {
                    // current array can accept more elements
                    batchOfDash.push(element);
                    needsToAddElement = false;
                    break;
                }
            }
            // Could not add the batch to existing batches
            if(needsToAddElement)
            {
                // Create new batch
                arrayBatchesOfDash.push([element]);
            }
        }
        return arrayBatchesOfDash;        
    }

    public async shardDashboardData(
        dashboardElementData:
        {
            title?: string,
            description?: string,
            elements: Array<DashboardTile<unknown>>
        } ,
        userInput: string, useNativeBQ: boolean): Promise<string> {
        
        // Break the current dashboard tiles into batches to send to LLM
        const arrayBatchesOfDash:Array<Array<DashboardTile<unknown>>> = this.breakTilesIntoBatches(dashboardElementData);
        
        const promptArray: Array<string> = [];
        // For each of the arrays, generate the prompts
        for (const arrayTiles of arrayBatchesOfDash)
        {
            let dict:{ [key: string]: {} } = {};
            for (const element of arrayTiles) {
                let index = 0;                
                const keyName:string = element.title? element.title : element.description? element.description : ""+ index;
                dict[keyName] = element.data;                
                index++;
            }
            const serializedModelFields:string = JSON.stringify(dict);
            const tileContext = "Dashboard Title: " + dashboardElementData.title + "Description: " + dashboardElementData.description;
            const prompt = this.getPromptService().fillByType(PromptTemplateTypeEnum.DASH_SUMMARIZE, {tileContext, serializedModelFields, userInput});
            promptArray.push(prompt);            
        }

        const arraySelect: Array<string> = [];
        promptArray.forEach((promptField) =>{
             const singleLineString = UtilsHelper.escapeBreakLine(promptField);
             var subselect = UtilsHelper.getQueryFromPrompt(singleLineString, useNativeBQ, "Dashboard");
             arraySelect.push(subselect);
        });
         // Join all the selects with union all
        const queryContents = arraySelect.join(" UNION ALL ");
0
        if(queryContents == null || queryContents.length == 0)
        {
            throw new Error('Could not generate field arrays on Prompt');
        }

        // Concat strings and send to LLM again
        return await this.getResultsFromBigQuery(queryContents, useNativeBQ);

    }

    
    /**
     * Sends prompt with dashboard data & question to LLM using BigQuery
     * @param dashboardElementData
     * @param question
     * @returns
     */
    public async sendPrompt(
        dashboardElementData:
        {
            title?: string,
            description?: string,
            elements: Array<DashboardTile<unknown>>
        } ,
        question: string, useNativeBQ:boolean): Promise<string> {
                
        let serializedElementData = JSON.stringify(dashboardElementData);            
        if (serializedElementData.length > DashboardService.MAX_CHAR_PER_PROMPT)
        {
            serializedElementData = await this.shardDashboardData(dashboardElementData, question, useNativeBQ);
        }                        
        const singleLineString = `Act as an experienced Business Data Analyst and answer the question having into context the following Data: ${serializedElementData} Question: ${question}`;                
        // Clean string to send to BigQuery
        const escapedPrompt =  UtilsHelper.escapeQueryAll(singleLineString);        
        var subselect = `SELECT '` + escapedPrompt + `' AS prompt`;
        if(!useNativeBQ)
        {
            subselect = `SELECT llm.bq_vertex_remote('` + escapedPrompt + `') AS r, '' AS status `;
        }                        
        Logger.debug("escapedPrompt: " + subselect);
        Logger.debug("Sending Prompt to BigQuery LLM");
        return this.getResultsFromBigQuery(subselect, useNativeBQ);    

    }


    private buildBigQueryLLMQuery(selectPrompt:string, useNativeBQ:boolean)
    {
        if(useNativeBQ == false)
        {
            return `#Looker GenAI Extension UDF - Dashboard - version: ${ConfigReader.CURRENT_VERSION}           
            ${selectPrompt}`;
        }
        return `#Looker GenAI Extension - Dashboard - version: ${ConfigReader.CURRENT_VERSION}
        SELECT ml_generate_text_llm_result as r, ml_generate_text_status as status
        FROM
        ML.GENERATE_TEXT(
            MODEL ${ConfigReader.BQML_MODEL},
            (
            ${selectPrompt}
            ),
            STRUCT(
            0.05 AS temperature,
            1024 AS max_output_tokens,
            0.98 AS top_p,
            TRUE AS flatten_json_output,
            1 AS top_k));
        `;
    }


    public async getResultsFromBigQuery(promptParameter:string, useNativeBQ:boolean): Promise<string>
    {
        const queryResults = await this.sendPromptToBigQuery(promptParameter, useNativeBQ);
        let result_string = "";        
        for(const queryResult of queryResults)
        {
            const status = queryResult.status;
            if (status!="" && status!=null) {
                // Log instead of breaking the application
                Logger.error("some of the llm results had an error: " + status);
            }            
            else
            {
                result_string = result_string.concat(queryResult.r + " \n");
            }            
        }        
        return result_string;
    }

    /**
     * 
     * Method to send the Prompt to BigQuery using sql service
     * @param promptParameter 
     * @returns 
     */
    private async sendPromptToBigQuery(promptParameter: string, useNativeBQ:boolean){
        // Create SQL Query to
        const query = this.buildBigQueryLLMQuery(promptParameter, useNativeBQ);
        const queryResults = await this.sql.execute<{
            r: string
            status: string
        }>(query);
        return queryResults;
    }
}







