import { UtilsHelper } from "../utils/Helper";

export enum PromptTemplateTypeEnum {
    FIELDS_FILTERS_PIVOTS_SORTS,
    PIVOTS,
    LIMITS,
    EXPLORE_VALIDATE_MERGED,
    DASH_SUMMARIZE,
}

export type PromptTypeMapperType = { [key in PromptTemplateTypeEnum]: string };

export class PromptTemplateService {
    private PromptTypeMapper: PromptTypeMapperType = {
        [PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: `Context: {{serializedModelFields}}
Question: {{userInput}}

Extract the exact fields names, filters and sorts from the Context in a JSON format that can help answer the Question.The fields are in the format "table.field".
If the Question contains a "top", "bottom", insert a "count" inside the fields.
JSON output format is the following
{
"field_names": [],
"filters": {},
"sorts": []
}

Examples:
Q: "What are the top 10 total sales price per brand. With brands: Levi's, Calvin Klein, Columbia"
{"field_names":["products.brand","order_items.total_sale_price"],"filters":{"products.brand":"Levi's, Calvin Klein, Columbia"}}

Q: "What are the top sales price, category, cost pivot per day and filter only orders with more than 15 items"
{"field_names":["order_items.total_sale_price", "products.category", "inventory_items.cost", "orders.created_date"], "filters": {"order_items.count": "> 15"}, "sorts": ["order_items.total_sales_price"]}

Q: "How many orders were created in the past 7 days"
{"field_names": ["orders.count"], "filters": {"sales_order.created_date": "7 days"}, "sorts": []}

Q: "What are the top 10 languages?"
{"field_names": ["wiki100_m.language","wiki100_m.count"], "filters":{}, "sorts": []}

Q: "What are the states that had the most orders, filter state: California, Nevada, Washinton, Oregon"
{"field_names": ["orders.count"], "filters": {"sales_order.state": "California, Nevada, Washington, Oregon"}, "sorts": []}
`,
[PromptTemplateTypeEnum.PIVOTS]: `
List of Fields: {{potentialFields}}
Question: {{userInput}}

Analyze the Question above, if it contains the word "pivot" or "pivotting", pick the appropriate fields exclusively from the List of Fields provided.
Ouput in JSON format:
{"pivots": [field1, field2]}

Examples:
List of Fields: [products.brand, products.category, inventory_items.cost, order_items.total_sale_price, orders.created_date]
Question: "What are the top sales price, category, brand, cost and created day. pivot per created day"
{"pivots": ["orders.created_date"]}

List of Fields: [products.brand, inventory_items.cost, order_items.total_sale_price, orders.created_date]
Question: "What are the top sales price per brand and per cost pivotting per date"
{"pivots": ["orders.created_date"]}

List of Fields: [ wiki100_m.day, wiki100_m.language, wiki100_m.count]
Question: "What are the top 15 count, language and day. Pivot per day"
{"pivots": ["wiki100_m.day"]}
`,

        [PromptTemplateTypeEnum.LIMITS]: `
Based on the Question: {{userInput}}
Extract the amount of records that the question wants.
The limit should be an integer from 1 to 500.
If nothing can be inferred from the question, use the default value: 500.
Examples:
Q: What are the top 10 languages?
10
Q: What are the top 50 products with the largest sales amount?
50
Q: What are the total sales per month?
500`,
        [PromptTemplateTypeEnum.EXPLORE_VALIDATE_MERGED]:`Context: {{mergedResults}}
The Context provided contains all the possible field_names, filters, pivots and sort.
Return the JSON with only the fields needed to answer following Question.
The ouput format is a valid JSON: {"field_names": [], "filters":{}, "pivots": [], "sorts": []}
Question: {{userInput}}`,

        [PromptTemplateTypeEnum.DASH_SUMMARIZE]:` 
Dashboard Context: {{dashboardContext}}
Tile Context: {{tileContext}}
InputData: {{serializedModelFields}}
Question: {{userInput}}

Based on the Question, Summarize the InputData in a relevant way to help answer this Question.
Calculate any necessary metrics such as Average, Min, Max, etc.
The ouput should be JSON.
`
    };
    
    public constructor(customPrompts?: Partial<PromptTypeMapperType>) {
        customPrompts = customPrompts || {};
        this.PromptTypeMapper = {            
            ...this.PromptTypeMapper,
            ...customPrompts
        };
    }

    public getByType(promptType:PromptTemplateTypeEnum): string
    {
        return this.PromptTypeMapper[promptType];
    }

    public fillByType(promptType: PromptTemplateTypeEnum, promptVariableContext: { [key: string]: string}): string {
        let replacedPrompt = this.PromptTypeMapper[promptType];
        Object.keys(promptVariableContext).forEach((key) => {
            replacedPrompt = replacedPrompt.replace(`{{${key}}}`, promptVariableContext[key]);            
        })
        replacedPrompt = UtilsHelper.escapeSpecialCharacter(replacedPrompt);            
        return replacedPrompt;
    }



}
