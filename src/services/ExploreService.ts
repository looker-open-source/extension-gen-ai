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
            Logger.debug("looker filter logs persisted sucessfuly", results);
        }
        catch(error)
        {
            Logger.error("unable to persist logs", error);
        }        
    }


    private async sendPromptToBigQuery(prompt: string): Promise<any>
    {
        const promptSingleLine = UtilsHelper.escapeBreakLine(prompt);
        const query = UtilsHelper.getQueryFromPrompt(promptSingleLine, this.useNativeBQ, "Explore");
        Logger.debug("Query to Run: " + query);
        const results = await this.sql.execute<{
            r: string
            status: string
        }>(query);

        if (results.length < 1) {
            throw new Error('prompt query didnt return any results');
        }
        const firstResult = UtilsHelper.firstElement(results).r;
        const cleanResult = UtilsHelper.cleanResult(firstResult);
        try {
            const valid = JSON.parse(cleanResult);
            return valid;
        } catch (err) {
            throw new Error('unable to parse prompt query result to JSON');
        }
    }

    public async generateExploreData(
        modelFields: FieldMetadata[],
        userInput: string): Promise<LookerExploreDataModel>
    {
        // Generate the Base Prompt
        const serializedModelFields: string = JSON.stringify(modelFields);
        const prompt = this.promptService.fillByType(PromptTemplateTypeEnum.EXPLORE_QUERY, {
            serializedModelFields,
            userInput,
        });
        const promptResult = await this.sendPromptToBigQuery(prompt);
        const allowedFieldNames: string[] = modelFields.map(field => field.name);
        const exploreData = new LookerExploreDataModel(promptResult, allowedFieldNames);        
        // Validate if word Pivots is present
        if(!this.validateInputForPivots(userInput))
        {
            Logger.debug("Removing Pivots");
            exploreData.pivots = [];
        }
        return exploreData;
    }

    private validateInputForPivots(userInput: string):boolean {
        const inputUpper = userInput.toLocaleUpperCase();
        if(inputUpper.includes("PIVOT") || inputUpper.includes("PIVOTTING")|| inputUpper.includes("PIVOTING"))
        {
            return true;
        }
        return false;
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

    public async answerQuestionWithData(userInput: string, queryId: string): Promise<string> {
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
        Logger.debug("Generate Prompt passing the data");
        const prompt = this.promptService.fillByType(PromptTemplateTypeEnum.EXPLORATION_OUTPUT, { serializedModelFields, userInput });
        const promptQuery = UtilsHelper.getQueryFromPrompt(UtilsHelper.escapeBreakLine(prompt), this.useNativeBQ, "Output");
        const results = await this.sql.execute<{
            r: string
            status: string
        }>(promptQuery);
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
