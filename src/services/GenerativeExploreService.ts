import { Looker40SDK } from "@looker/sdk";
import { IDictionary } from "@looker/sdk-rtl";
import LookerExploreDataModel, { ILookerExploreDataModel } from "../models/LookerExploreData";
import { UtilsHelper } from "../utils/Helper";
import { LookerSQLService } from "./LookerSQLService";

export interface FieldMetadata{
    label: string;
    name: string;
    description: string;
    // type: string;    
}

enum PromptType {
    FIELDS_FILTERS_PIVOTS_SORTS,
    FILTERS,
    SORTS,
    PIVOTS,
    LIMITS
}

export class GenerativeExploreService {
    private sql: LookerSQLService;

    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
    }

    //    Method that breaks the exploreFields into chunks based on the max number of tokens
    private breakFieldsPerToken(modelFields: FieldMetadata[]): Array<FieldMetadata[]>{
        const FIXED_BREAK_PER_QUANTITY=200;
        const generatedPromptsArray = new Array<FieldMetadata[]>;
        var totalLength = modelFields.length;
        // divide by n elements
        var maxInteractions = totalLength/FIXED_BREAK_PER_QUANTITY;
        for(let i=0; i < maxInteractions; i++){
            generatedPromptsArray.push(modelFields.slice(i*FIXED_BREAK_PER_QUANTITY, (i+1)*FIXED_BREAK_PER_QUANTITY));
        }
        return generatedPromptsArray;
    }

    private getPromptTemplatePerType(
        serializedModelFields:string,
        userInput:string,
        promptType: PromptType,
        userFilter?: string
        ):string
    {
        switch(promptType){
            case PromptType.FIELDS_FILTERS_PIVOTS_SORTS:
                return `Context: ${serializedModelFields}
Question: ${userInput}

Extract the exact fields, filters, pivots, explicit_pivots from the Context in a JSON format that can help answer the Question.The fields are in the format "table.field".
explicit_pivots are the fields that are mentioned explicitly after the word "pivot" or "pivoting" keyword inside the Question.
Whenever the question contains a count or total, include a count inside the fields.

{
    "fields": [],
    "filters": {},
    "pivots": [],
    "explicit_pivots": [],
    "sorts": []
}

Examples:
Q: "What are the top 10 total sales price per brand. With brands: Levi\\'s, Calvin Klein, Columbia"
{"fields":["products.brand","order_items.total_sale_price"],"filters":{"products.brand":"Levi\\'s, Calvin Klein, Columbia"}}

Q: "What are the top sales price, category, cost pivot per day and filter only orders with more than 15 items"
{"fields":["order_items.total_sale_price", "products.category", "inventory_items.cost"], "pivots": ["orders.created_date"], "filters": {"order_items.count": "> 15"}}

Q: "How many orders were created in the past 7 days"
{"fields": ["orders.count"], "filters": {"sales_order.created_date": "7 days"}}

Q: "What are the states that had the most orders, filter state: California, Nevada, Washinton, Oregon"
{"fields": ["orders.count"], "filters": {"sales_order.state": "California, Nevada, Washington, Oregon"}}
`;
            case PromptType.FILTERS:
                return `
LookerLLM Context: ${serializedModelFields}
Examples:
Q: orders in the last month
{"filters": {"order_items.created_month": "last month"}}
Q: Orders have more than 45 items.
{"filters": {"order_items.count": "> 15"}}
Q: Orders Created in the past 7 days
{"filters": {"sales_order.created_date": "7 days"}}
Q: states: California, Nevada, Washinton and Oregon.
{"filters": {"sales_order.state": "California, Nevada, Washington, Oregon"}}
Q: e-mail adress is not null
{"filters": {"user.email_address": "-NULL"}}

Following the examples above.
Extract only the exact field names that filters a specific value inside the Filter Expression.
Analyze the value being expressed to check if it matches one of the fields and give the full expression.
Use only fields from the LookerLLM Context that makes sense to be filtered on.
If there is a mention with dates, find an appropriate field that will contain a date to filter.
If there are no filters to return, return JSON {"filters": {}}.
The output format is in JSON format {"filters": {"order_items.created_month": "last month", "order_items.count": "> 15", "order_items.sales_amount": "< 300"}

Q: ${userInput}
`;
            case PromptType.LIMITS:
                return `
Based on the Question: ${userInput}
Extract the amount of records that the question wants.
The limit should be an integer from 1 to 500.
If nothing can be inferred from the question, use the default value: 500.
Examples:
Q: What are the top 10 languages?
10
Q: What are the top 50 products with the largest sales amount?
50
Q: What are the total sales per month?
500
`;
            default:
                return "Unkown";
        }
    }

    private generatePrompt(
        modelFields: FieldMetadata[],
        userInput: string,
        promptType: PromptType):Array<string> {

        const shardedPrompts:Array<string> = [];
        userInput = UtilsHelper.escapeSpecialCharacter(userInput);
        // Prompt for Limits only needs the userInput
        if(promptType == PromptType.LIMITS)
        {
            shardedPrompts.push(this.getPromptTemplatePerType("", userInput, promptType));
        }
        else
        {
            const generatedPromptsArray:Array<FieldMetadata[]> = this.breakFieldsPerToken(modelFields);
            for(const fieldGroup of generatedPromptsArray){
                const serializedModelFields = JSON.stringify(fieldGroup);
                const generatedPrompt = this.getPromptTemplatePerType(serializedModelFields, userInput, promptType);
                shardedPrompts.push(generatedPrompt);
            }
        }
        return shardedPrompts;
    }

    private validateLLMFields(
        modelFields: FieldMetadata[],
        llmFields: Array<string>
    ): Array<string>
    {
        const cleanLLMFields: Array<string> = [];
        for(const modelField of modelFields )
        {
            if(modelField.name!= null)
            {
                for(const llmField of llmFields)
                {
                    if(llmField == modelField.name)
                    {
                        console.log("LLMField equals modelField.name")
                        cleanLLMFields.push(llmField);
                        break;
                    }
                }
            }
        }
        console.log("Input1 eram: " + JSON.stringify(llmFields) + " Output: " + JSON.stringify(cleanLLMFields));
        return cleanLLMFields;
    }

    private validateFilterFormatValue(filterValue: string):string
    {
        var cleanFilterValue = filterValue.replace("_", " ");
        cleanFilterValue = cleanFilterValue.replace("-", " ");
        // validate and replace other invalid patterns
        return cleanFilterValue;
    }

    private validateLLMFilters(
        modelFields: FieldMetadata[],
        llmFilters: IDictionary<string>
    ): IDictionary<string>
    {
        const cleanLLMFields: IDictionary<string> = {};
        for(const modelField of modelFields )
        {
            if(modelField.name!= null && llmFilters!=null)
            {
                for(const key of Object.keys(llmFilters))
                {
                    if(key == modelField.name)
                    {
                        // Validate Filter Values
                        if(this.validateFilterFormatValue(llmFilters[key]) != "")
                        {
                            cleanLLMFields[key] = llmFilters[key];
                        }
                        break;
                    }
                }
            }
        }
        console.log("Input Dict eram: " + llmFilters.length + " Output: " + cleanLLMFields.length);
        return cleanLLMFields;
    }


    private buildBigQueryLLMQuery(selectPrompt:string)
    {
        return `SELECT ml_generate_text_llm_result as r, ml_generate_text_status as status
        FROM
        ML.GENERATE_TEXT(
            MODEL llm.llm_model,
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
         console.log("Query to Run: " + queryToRun);
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
        const fieldsPrompts: Array<string> = this.generatePrompt(modelFields, userInput, PromptType.FIELDS_FILTERS_PIVOTS_SORTS);
        const llmChunkedResults = await this.retrieveLookerParametersFromLLM(fieldsPrompts);
        const allowedFieldNames: string[] = modelFields.map(field => field.name);
        const mergedResults = new LookerExploreDataModel({
            fields: [],
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
                    console.log("Not found any JSON results from LLM");
                    continue;
                }
                const llmChunkResult = JSON.parse(chunkResult.r);
                const exploreDataChunk = new LookerExploreDataModel(llmChunkResult, allowedFieldNames);
                mergedResults.merge(exploreDataChunk);
            } catch (error: Error) {
                console.error(error.message, chunkResult);
                throw new Error('LLM result does not contain a valid JSON');
            }
        }
        // remove pivots if not mentioned
        if(!this.validateInputForPivots(userInput))
        {
            mergedResults.pivots = [];
        }
        // call LLM to ask for Limits
        const limitFromLLM = await this.findLimitsFromLLM(userInput);
        // replace limit
        if (limitFromLLM) {
            mergedResults.limit = limitFromLLM;
        }
        mergedResults.validate(allowedFieldNames);
        // TODO: recheck with LLM if the fields makes sense;
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
        const promptLimit = this.generatePrompt([], userInput, PromptType.LIMITS);
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
        try {
            const llmQueryResult = await this.sql.createQuery({
                model: modelName,
                view: viewName,
                ...exploreData,
            })
            const queryId = llmQueryResult.value.client_id;
            if (!queryId) {
                throw new Error('unable to retrieve query id from created query')
            }
            console.log("llmQuery: " + JSON.stringify(exploreData, null, 2));
            return {
                queryId,
                modelName,
                view: viewName,
            }
        } catch (err) {
            console.log("LLM does not contain valid JSON: ");
            throw new Error('LLM result does not contain a valid JSON');
        }
    }
}
