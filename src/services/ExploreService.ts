/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { Looker40SDK } from "@looker/sdk";
import { IDictionary } from "@looker/sdk-rtl";
import LookerExploreDataModel from "../models/LookerExploreData";
import { UtilsHelper } from "../utils/Helper";
import { LookerSQLService } from "./LookerSQLService";
import { PromptTemplateService, PromptTemplateTypeEnum } from "./PromptTemplateService";
import { Logger } from "../utils/Logger"
import { ConfigReader } from "./ConfigReader";

export interface FieldMetadata{
    label: string;
    name: string;
    description: string;
    // type: string;
}


export class ExploreService {
    private sql: LookerSQLService;
    private promptService: PromptTemplateService;

    public constructor(lookerSDK: Looker40SDK, promptService: PromptTemplateService) {
        this.sql = new LookerSQLService(lookerSDK);
        this.promptService = promptService;
    }

    //    Method that breaks the exploreFields into chunks based on the max number of tokens
    private breakFieldsPerToken(modelFields: FieldMetadata[]): Array<FieldMetadata[]>{
        const FIXED_BREAK_PER_QUANTITY=800;
        const generatedPromptsArray = new Array<FieldMetadata[]>;
        var totalLength = modelFields.length;
        // divide by n elements
        var maxInteractions = totalLength/FIXED_BREAK_PER_QUANTITY;
        for(let i=0; i < maxInteractions; i++){
            generatedPromptsArray.push(modelFields.slice(i*FIXED_BREAK_PER_QUANTITY, (i+1)*FIXED_BREAK_PER_QUANTITY));
        }
        return generatedPromptsArray;
    }


    private generatePrompt(
        modelFields: FieldMetadata[],
        userInput: string,
        promptTypeEnum: PromptTemplateTypeEnum,
        potentialFields?:string, 
        mergedResults?:string):Array<string> {        

        const shardedPrompts:Array<string> = [];        
        // Prompt for Limits only needs the userInput
        switch(promptTypeEnum)
        {
            case PromptTemplateTypeEnum.LIMITS:
                shardedPrompts.push(this.promptService.fillByType(promptTypeEnum, { userInput }));
                break;
            case PromptTemplateTypeEnum.PIVOTS:
                if(potentialFields!=null)
                {
                    shardedPrompts.push(this.promptService.fillByType(promptTypeEnum, { userInput, potentialFields}));
                }                
                break;
            case PromptTemplateTypeEnum.EXPLORE_VALIDATE_MERGED:
                if(mergedResults!=null && userInput!=null)
                    {
                        shardedPrompts.push(this.promptService.fillByType(promptTypeEnum, { userInput, mergedResults}));
                    }
                break;

            default:
                const generatedPromptsArray:Array<FieldMetadata[]> = this.breakFieldsPerToken(modelFields);
                for(const fieldGroup of generatedPromptsArray){
                    const serializedModelFields = JSON.stringify(fieldGroup);
                    const generatedPrompt = this.promptService.fillByType(promptTypeEnum, {serializedModelFields, userInput});
                    shardedPrompts.push(generatedPrompt);
                }
                break;        
        }        
        return shardedPrompts;
    }

    private buildBigQueryLLMQuery(selectPrompt:string)
    {
        return `#Looker GenAI Extension - version: ${ConfigReader.CURRENT_VERSION}
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

    private async logLookerFilterFields(modelFields: FieldMetadata[], userInput: string, result: LookerExploreDataModel):Promise<string>
    {
        const queryToRun = `INSERT INTO ${ConfigReader.EXPLORE_LOGGING}(creation_timestamp, userInput, modelFields, llmResult) VALUES(
            CURRENT_TIMESTAMP(),
            '${userInput}',
            JSON '${JSON.stringify(modelFields)}',
            JSON '${JSON.stringify(result)}')`;        
        const results = await this.sql.executeLog(queryToRun);         
        return results;
    }



    private async retrieveLookerParametersFromLLM(promptArray:Array<string>)
    {
        const arraySelect: Array<string> = [];
        promptArray.forEach((promptField) =>{
             const singleLineString = UtilsHelper.escapeBreakLine(promptField);
             const subselect = `SELECT '` + singleLineString + `' AS prompt`;                        
             arraySelect.push(subselect);
        });
         // Join all the selects with union all
        const queryContents = arraySelect.join(" UNION ALL ");

        if(queryContents == null || queryContents.length == 0)
        {
            throw new Error('Could not generate field arrays on Prompt');
        }
         // query to run
         const queryToRun = this.buildBigQueryLLMQuery(queryContents);
         Logger.debug("Query to Run: " + queryToRun);                 
         const results = await this.sql.execute<{
             r: string
             status: string
         }>(queryToRun);         
         return results;
    }

    private async getExplorePayloadFromLLM(
        modelFields: FieldMetadata[],
        userInput: string): Promise<LookerExploreDataModel>
    {
        // Generate the Base Prompt
        const fieldsPrompts: Array<string> = this.generatePrompt(modelFields, userInput, PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS);
        const llmChunkedResults = await this.retrieveLookerParametersFromLLM(fieldsPrompts);
        const allowedFieldNames: string[] = modelFields.map(field => field.name);
        let mergedResults = new LookerExploreDataModel({
            field_names: [],
            filters: {},
            pivots: [],
            sorts: [],
            limit: '10',
        }, allowedFieldNames);
        // Read from multiple shards
        for(const chunkResult of llmChunkedResults)
        {
            try {
                if (!chunkResult || !chunkResult.r || chunkResult.r.length === 0) {
                    Logger.trace("Not found any JSON results from LLM");
                    continue;
                }
                const cleanResult = UtilsHelper.cleanResult(chunkResult.r);
                const llmChunkResult = JSON.parse(cleanResult);
                const exploreDataChunk = new LookerExploreDataModel(llmChunkResult, allowedFieldNames);
                mergedResults.merge(exploreDataChunk);
            } catch (error) {
                // @ts-ignore
                Logger.error(error.message, chunkResult);
                // throw new Error('LLM result does not contain a valid JSON');
            }
        }
        // call LLM to ask for Limits and Pivots
        const limitFromLLMPromise = this.findLimitsFromLLM(userInput);
        const pivotsFromLLMPromise = this.findPivotsFromLLM(userInput, mergedResults.field_names);
        const [limitFromLLM, pivotsFromLLM] = await Promise.all([limitFromLLMPromise, pivotsFromLLMPromise]);
        
        if (pivotsFromLLM) {
            mergedResults.pivots = pivotsFromLLM;
        }
        // replace limit
        if (limitFromLLM) {
            mergedResults.limit = limitFromLLM;
        }
        // Only execute merged from LLM logic if needed
        if(llmChunkedResults.length > 1)
        {
            Logger.debug("Validate merged result");
            // send the merged results to a final LLM to validate the merged Results
            const checkMergedFromLLM:LookerExploreDataModel = await this.checkMergedFromLLM(mergedResults, userInput, allowedFieldNames);
            // remove pivots if not mentioned explicitly
            mergedResults = checkMergedFromLLM;                               
        }
        // Validate if word Pivots is present
        if(!this.validateInputForPivots(userInput))
        {
            Logger.debug("Removing Pivots");
            mergedResults.pivots = [];
        }
        return mergedResults;
        
       
    }

    private validateInputForPivots(userInput: string):boolean {
        const inputUpper = userInput.toLocaleUpperCase();
        if(inputUpper.includes("PIVOT") || inputUpper.includes("PIVOTTING")|| inputUpper.includes("PIVOTING"))
        {
            return true;
        }
        return false;
    }


    private async findLimitsFromLLM(
        userInput: string): Promise<string>
    {
        // Generate Prompt returns an array, gets the first for the LIMIT
        const promptLimit = this.generatePrompt([], userInput, PromptTemplateTypeEnum.LIMITS);
        const results  = await this.retrieveLookerParametersFromLLM(promptLimit);
        const limitResult = UtilsHelper.firstElement(results).r;
        // validate the result
        try {
            var limitInt = parseInt(limitResult);
            if(limitInt > 0 && limitInt <= 500)
            {
                return limitResult;
            }
            else
            {
                // throw new Error("Limit not returning correct due to prompt, going to default");
                return "500";
            }
        }
        catch (err) {
            // throw new Error("Limit not returning correct due to prompt, going to default");
            return "500";
        }
    }
    private async findPivotsFromLLM( 
        userInput: string,
        potentialFields: Array<string>
        ): Promise<Array<string>>
    {       
        let arrayPivots:Array<string> = [];    
        try
        {            
            const potentialFieldsString = JSON.stringify(potentialFields);
            // Generate Prompt returns an array, gets the first for the LIMIT
            const promptPivots = this.generatePrompt([], userInput, PromptTemplateTypeEnum.PIVOTS, potentialFieldsString);
            const results  = await this.retrieveLookerParametersFromLLM(promptPivots);                
            const pivotResult = UtilsHelper.firstElement(results).r;
            const cleanResult = UtilsHelper.cleanResult(pivotResult);
            // TODO: Validate result from schema joi
            var llmResultLine = JSON.parse(cleanResult);
            if(llmResultLine.pivots != null && llmResultLine.pivots.length > 0)
            {
                arrayPivots = arrayPivots.concat(llmResultLine.pivots);
            }
            // Validate results
            arrayPivots.concat(pivotResult);  
            return arrayPivots;
        }
        catch (err) {
            return arrayPivots;
            // throw new Error("Pivot not returning fields, going to default");
        }
    }

    private async checkMergedFromLLM( 
        mergedModel: LookerExploreDataModel,
        userInput: string,
        allowedFieldNames: string[]
        ): Promise<LookerExploreDataModel>
    {       
        let arrayPivots:Array<string> = [];    
        try
        {
            const mergedResultsString = JSON.stringify(mergedModel);
            // Generate Prompt returns an array, gets the first for the LIMIT
            const promptCheckMerged = this.generatePrompt([], userInput, PromptTemplateTypeEnum.EXPLORE_VALIDATE_MERGED, undefined, mergedResultsString);
            const results  = await this.retrieveLookerParametersFromLLM(promptCheckMerged);
            const mergedChecked = UtilsHelper.firstElement(results).r;               
            const cleanResult = UtilsHelper.cleanResult(mergedChecked);
            var llmResultLine = JSON.parse(cleanResult);
            return new LookerExploreDataModel(llmResultLine, allowedFieldNames);
        }
        catch(error)
        {
            // return the original input
            Logger.error("LLM could not clean and validate mergedResults");
            return mergedModel;
        }
    }

    public async generatePromptSendToBigQuery(
        modelFields: FieldMetadata[],
        userInput: string,
        modelName: string,
        viewName: string): Promise<{
            queryId: string,
            modelName: string,
            view: string,
        }> {
        // Call LLM to find the fields
        const exploreData = await this.getExplorePayloadFromLLM(modelFields, userInput);
        
        // Don't wait and check if there are errors because its logging to BigQuery DML Best Effort
        this.logLookerFilterFields(modelFields, userInput, exploreData);
    
        try {
            const llmQueryResult = await this.sql.createQuery({
                model: modelName,
                view: viewName,
                fields: exploreData.field_names,
                filters: exploreData.filters,
                pivots: exploreData.pivots,
                sorts: exploreData.sorts,
                limit: exploreData.limit,
            })
            const queryId = llmQueryResult.value.client_id;
            if (!queryId) {
                throw new Error('unable to retrieve query id from created query');
            }
            Logger.info("llmQuery: " + JSON.stringify(exploreData, null, 2));            
            return {
                queryId,
                modelName,
                view: viewName,
            }
        } catch (err) {
            Logger.error("LLM does not contain valid JSON: ");
            throw new Error('LLM result does not contain a valid JSON');
        }
    }
}
