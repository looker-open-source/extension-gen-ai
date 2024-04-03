/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import {
    Looker40SDK,
    ILookmlModelExploreFieldset,
    ILookmlModelExploreField
} from "@looker/sdk";
import LookerExploreDataModel from "../models/LookerExploreData";
import LookerExploreQueryModel from "../models/LookerExploreQuery";
import { UtilsHelper } from "../utils/Helper";
import { Logger } from "../utils/Logger";
import { ConfigReader } from "./ConfigReader";
import { LookerSQLService } from "./LookerSQLService";
import { PromptTemplateService, PromptTemplateTypeEnum } from "./PromptTemplateService";

export interface FieldMetadata{
    label: string;
    name: string;
    description: string;
    type: string;
}


export class ExploreService {

    private lookerSDK: Looker40SDK;
    private sql: LookerSQLService;
    private promptService: PromptTemplateService;
    private llmModelSize: number;
    private useNativeBQ: boolean;
    private MAX_CHAR_PER_PROMPT: number;
    private FIXED_BREAK_PER_QUANTITY: number;

    public constructor(lookerSDK: Looker40SDK, promptService: PromptTemplateService, llmModelSize:string, useNativeBQ:boolean) {
        this.lookerSDK = lookerSDK;
        this.sql = new LookerSQLService(this.lookerSDK);
        this.promptService = promptService;
        this.llmModelSize = parseInt(llmModelSize);
        this.MAX_CHAR_PER_PROMPT = this.llmModelSize * 2500;
        this.FIXED_BREAK_PER_QUANTITY = this.llmModelSize * 25;
        this.useNativeBQ = useNativeBQ;
    }

    //    Method that breaks the exploreFields into chunks based on the max number of tokens
    private breakFieldsPerToken(modelFields: FieldMetadata[]): Array<FieldMetadata[]>{
        const generatedPromptsArray: Array<FieldMetadata[]> = [];
        // get the total length of the json array
        var totalLength = JSON.stringify(modelFields).length;
        // divide by n elements
        var maxInteractions = totalLength/this.MAX_CHAR_PER_PROMPT;
        Logger.debug("Max Interactions: " +  maxInteractions + " totalLength: " + totalLength);
        for(let i=0; i < maxInteractions; i++){
            generatedPromptsArray.push(modelFields.slice(i*this.FIXED_BREAK_PER_QUANTITY, (i+1)*this.FIXED_BREAK_PER_QUANTITY));
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

    private buildBigQueryLLMWithType(selectPrompt:string, type:string)
    {
        if(this.useNativeBQ == false)
        {
            return `#Looker Ext GenAI UDF - ${type} - v: ${ConfigReader.CURRENT_VERSION}
            ${selectPrompt}`;
        }
        return `#Looker Ext GenAI - ${type} - v: ${ConfigReader.CURRENT_VERSION}
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

    public async logLookerFilterFields(modelFields: FieldMetadata[], userInput: string, result: LookerExploreDataModel, thumbsUpDownNone: number)
    {    
        try{
            const queryToRun = `#Looker ExtGenAI logging filter Fields - v: ${ConfigReader.CURRENT_VERSION}
            BEGIN
            INSERT INTO ${ConfigReader.EXPLORE_LOGGING}(creation_timestamp, userInput, modelFields, llmResult, thumbsUpDownNone) VALUES(
                CURRENT_TIMESTAMP(),
                '${UtilsHelper.escapeQueryAll(userInput)}',
                JSON '${UtilsHelper.escapeQueryAll(JSON.stringify(modelFields))}',
                JSON '${UtilsHelper.escapeQueryAll(JSON.stringify(result))}',
                ${thumbsUpDownNone}
                );
            SELECT 1; 
            END`;        
            const results = await this.sql.execute(queryToRun);
            Logger.info("looker filter logs persisted sucessfuly", results);
        }
        catch(error)
        {
            Logger.error("unable to persist logs", error);
        }        
    }


    private async retrieveLookerParametersFromLLM(promptArray:Array<string>)
    {
        const arraySelect: Array<string> = [];
        promptArray.forEach((promptField) =>{
             const singleLineString = UtilsHelper.escapeBreakLine(promptField);
             arraySelect.push(UtilsHelper.getQueryFromPrompt(singleLineString, this.useNativeBQ));
        });
         // Join all the selects with union all
        const queryContents = arraySelect.join(" UNION ALL ");

        if(queryContents == null || queryContents.length == 0)
        {
            throw new Error('Could not generate field arrays on Prompt');
        }
         // query to run
         const queryToRun = this.buildBigQueryLLMWithType(queryContents, "Explore");
         Logger.debug("Query to Run: " + queryToRun);
         const results = await this.sql.execute<{
             r: string
             status: string
         }>(queryToRun);
         return results;
    }

    public async generateExploreData(
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
                if (!(error instanceof Error)) {
                    throw new Error('unexpected error trying to generate explore data');
                }
                Logger.error(error.message, chunkResult);
                throw new Error('LLM result does not contain a valid JSON');
            }
        }
        // call LLM to ask for Limits and Pivots
        const pivotsFromLLM = await this.findPivotsFromLLM(userInput, mergedResults.field_names);
        if (pivotsFromLLM) {
            mergedResults.pivots = pivotsFromLLM;
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

    public async createExploreQuery(
        exploreData: LookerExploreDataModel,
        modelName: string,
        viewName: string): Promise<LookerExploreQueryModel> {
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
            const clientId = llmQueryResult.value.client_id!;
            const queryId = llmQueryResult.value.id;
            if (!queryId) {
                throw new Error('unable to retrieve query id from created query');
            }
            const exploreQuery = new LookerExploreQueryModel({
                clientId,
                queryId,
                modelName,
                viewName,
            });
            Logger.trace("explore query created", { exploreQuery, exploreData });
            return exploreQuery;
        } catch (err) {
            Logger.error("LLM does not contain valid JSON: ");
            throw new Error('LLM result does not contain a valid JSON');
        }
    }

    public async answerQuestionWithData(prompt: string, queryId: string): Promise<string> {
        const userInput = prompt;
        Logger.info("Getting the raw data from the explore");
        let elementData: Array<any> = await this.sql.executeByQueryId(queryId);
        // max number of elements to pass to dashboard
        let totalChars = 0;
        let limitData = elementData;
        for (let i = 0; i < elementData.length; i++) {
            totalChars += JSON.stringify(elementData[i]).length;
            if (totalChars > this.MAX_CHAR_PER_PROMPT) {
                limitData = elementData.slice(0, i);
                break;
            }
        }
        const serializedModelFields = JSON.stringify(limitData);
        Logger.info("Generate Prompt passing the data");
        const promptToRun = this.promptService.fillByType(PromptTemplateTypeEnum.EXPLORATION_OUTPUT, { serializedModelFields, userInput});
        var queryPrompt = UtilsHelper.getQueryFromPrompt(UtilsHelper.escapeBreakLine(promptToRun), this.useNativeBQ);
        const queryToRun = this.buildBigQueryLLMWithType(queryPrompt, "Output");
        const results = await this.sql.execute<{
            r: string
            status: string
        }>(queryToRun);

        let result_string = "";
        for(const queryResult of results)
        {
            const status = queryResult.status;
            if (status!="" && status!=null) {
                // Log instead of breaking the application
                throw new Error("some of the llm results had an error: " + status);
            }
            result_string = result_string.concat(queryResult.r + " \n");
        }
        return result_string;
    }

    public async getExplorerFieldDefinitions(modelName: string, exploreName: string) {
        const exploreResult = await this.lookerSDK.lookml_model_explore(modelName, exploreName, "id, name, description, fields, label");
        if(!exploreResult.ok)
        {
            throw new Error(`invalid looker response ${exploreResult.error.message}`);
        }
        if (!exploreResult.value.fields) {
            throw new Error('unable to find field definition for given model')
        }
        if (!exploreResult.value.name) {
            throw new Error('unable to identity view name in explore field definitions result');
        }
        const viewName: string = exploreResult.value.name;
        const fields: ILookmlModelExploreFieldset = exploreResult.value.fields;
        const fieldDimensions: ILookmlModelExploreField[]  =  fields.dimensions!;
        const fieldMeasures: ILookmlModelExploreField[]  =  fields.measures!;
        const dimensionsAndMeasures = fieldDimensions.concat(fieldMeasures);
        var fieldDefinitions: Array<FieldMetadata> = [];
        if(!dimensionsAndMeasures) {
            throw new Error("missing measures / dimensions");
        }
        for(var field of dimensionsAndMeasures)
        {
            // skip hidden fields
            if (field.hidden === true) {
                continue;
            }
            var fieldMetadata: FieldMetadata = {
                label : field.label!,
                name: field.name!,
                type: field.type!,
                description: field.description!
            };
            fieldDefinitions.push(fieldMetadata);
        }
        return {
            viewName,
            fieldDefinitions,
        }
    }
}
