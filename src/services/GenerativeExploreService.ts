import { ILookmlModelExploreField, ISqlQueryCreate, IWriteQuery, Looker40SDK, user} from "@looker/sdk";
import { UtilsHelper } from "../utils/Helper";
import { LookerSQLService } from "./LookerSQLService";
import { IDictionary } from "@looker/sdk-rtl";
import { clean, validRange } from "semver";
import { Field } from "@looker/components";
import { Prompt } from "react-router-dom";

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
                return `
LookerLLM Context: ${serializedModelFields}
Question: ${userInput} 
Act as an experienced data analyst that can extract field names based on the business Question.
Using the LookerLLM Context with the field names, extract the desired field names, filters, pivots and sorts from the question in a JSON format.
Valid fields are fields, filters, pivots and sorts.
Whenever a period restriction is mentioned, identify it as a filter.
Filter format follow the examples below:
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

    private removeInexistentFields(
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
        console.log("Input1 eram: " + llmFields.length + " Output: " + cleanLLMFields.length);
        return cleanLLMFields;
    }

    private removeInexistentFieldsFromDict(
        modelFields: FieldMetadata[],
        llmFields: IDictionary<string>
    ): IDictionary<string>
    {
        const cleanLLMFields: IDictionary<string> = {};        
        for(const modelField of modelFields )
        {            
            if(modelField.name!= null && llmFields!=null)
            {
                for(const key of Object.keys(llmFields))
                {            
                    if(key == modelField.name)
                    {
                        console.log("LLMField equals modelField.name")
                        cleanLLMFields[key] = llmFields[key];
                        break;
                    }
                }
            }
        }
        console.log("Input Dict eram: " + llmFields.length + " Output: " + cleanLLMFields.length);
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
            0.2 AS temperature,
            1024 AS max_output_tokens,
            0.95 AS top_p,
            TRUE AS flatten_json_output,
            40 AS top_k));
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


    private async findFiltersFromLLM(
        modelFields: FieldMetadata[],
        userFilter: string): Promise<IDictionary<string>>    
    {
         // First generate prompt for Fields
         const promptFilters:Array<string> = this.generatePrompt(modelFields, userFilter, PromptType.FILTERS);
         const results = await this.retrieveLookerParametersFromLLM(promptFilters);
         var filtersToUse:IDictionary<string> = {};
         for(var result of results)
         {
             try {
                 if(result!=null && result.r != null && result.r.length > 0)
                 {
                     var llmResultLine = JSON.parse(result.r);
                     const filters = llmResultLine.filters;
                     for (const key in filters)
                     {
                        filtersToUse[key] = filters[key];
                     }
                 }
                 else{
                    if(result.status!=null)
                    {
                        console.log("result not found, status: "+ result.status);
                    }
                     console.log("Not found any fields:");
                 }       
                 console.log(filtersToUse);                         
             } catch (err) {
                 console.log("Invalid JSON parse: " + result);
                //  Ignoring this return and work with the others
                //  throw new Error('LLM result does not contain a valid JSON');
             }
         }
         //Remove filters that does not exists
         filtersToUse = this.removeInexistentFieldsFromDict(modelFields, filtersToUse);
         
         return filtersToUse;
    }

    private async getExplorePayloadFromLLM( 
        modelFields: FieldMetadata[],
        userInput: string, 
        userFilter?: string,
        userPivot?:string): Promise<Array<string>>
    {
        // Generate the Base Prompt
        const fieldsPrompts:Array<string> = this.generatePrompt(modelFields, userInput, PromptType.FIELDS_FILTERS_PIVOTS_SORTS);
        const results = await this.retrieveLookerParametersFromLLM(fieldsPrompts);
        var arrayLLMFields:Array<string> = [];
        var filtersToUse:IDictionary<string> = {};
        for(var result of results)
        {
            try {
                if(result!=null && result.r != null && result.r.length > 0)
                {
                    var llmResultLine = JSON.parse(result.r);                                    
                    arrayLLMFields = arrayLLMFields.concat(llmResultLine.fields);
                    const filters = llmResultLine.filters;
                    for (const key in filters)
                    {
                       filtersToUse[key] = filters[key];
                    }
                }
                else{
                    console.log("Not found any fields");
                }                                
            } catch (err) {
                console.log(result);
                throw new Error('LLM result does not contain a valid JSON');
            }
        }
        //Remove fields that does not exists
        arrayLLMFields = this.removeInexistentFields(modelFields, arrayLLMFields);
        filtersToUse = this.removeInexistentFieldsFromDict(modelFields, filtersToUse);

        // Recheck with the LLM with the selected fields and modelFields if they are good to go or will eliminate some fields
        if(arrayLLMFields.length > 2)
        {
            // TODO: recheck with LLM if the fields makes sense;
        }
        return arrayLLMFields;
    }

   
    private async findLimitsFromLLM( 
        userInput: string): Promise<string>
    {
        // Generate Prompt returns an array, gets the first for the LIMIT
        const promptLimit = this.generatePrompt([], userInput, PromptType.LIMITS);
        const results  = await this.retrieveLookerParametersFromLLM(promptLimit);                
        const limitResult = UtilsHelper.firstElement(results).r;
        // validate the result
        const limitNumber = 500;
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
        inputModelName: string,
        inputViewName: string): Promise<{
        queryId: string,
        modelName: string,
        view: string,
    }> {

        // Call LLM to find the fields
        const fieldsFromLLM = await this.getExplorePayloadFromLLM(modelFields, userInput);
        console.log("ArrayFields: " + fieldsFromLLM);

        // Finding the filters
        // var filtersFromLLM = {}
        // if(userFilters!= null && userFilters.length > 0)
        // {
        //     filtersFromLLM = await this.findFiltersFromLLM(modelFields, userFilters);
        // }
        // console.log("fillters: " + JSON.stringify(filtersFromLLM))    

        // call LLM to ask for Limits
        const limitFromLLM = await this.findLimitsFromLLM(userInput);
        console.log("limitFromLLM: " + limitFromLLM);        

        let llmQuery: IWriteQuery;
        try {
            llmQuery = {
                model: inputModelName,
                view: inputViewName,
                fields: fieldsFromLLM,
                // filters: filtersFromLLM,
                limit: limitFromLLM
            };
            console.log("llmQuery: " + JSON.stringify(llmQuery));
        } catch (err) {
            console.log("LLM does not contain valid JSON: ");
            throw new Error('LLM result does not contain a valid JSON');
        }
        const llmQueryResult = await this.sql.createQuery(llmQuery)
        const queryId = llmQueryResult.value.client_id;
        if (!queryId) {
            throw new Error('unable to retrieve query id from created query')
        }
        const modelName = llmQueryResult.value.model;
        const view = llmQueryResult.value.view;
        return {
            queryId,
            modelName,
            view,
        }
    }

   
}
