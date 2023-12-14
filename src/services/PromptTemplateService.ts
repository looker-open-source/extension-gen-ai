/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { UtilsHelper } from "../utils/Helper";

export enum PromptTemplateTypeEnum {
    FIELDS_FILTERS_PIVOTS_SORTS,
    PIVOTS,
    LIMITS,
    EXPLORE_VALIDATE_MERGED,
    DASH_SUMMARIZE,
    EXPLORATION_OUTPUT
}

export type PromptTypeMapperType = { [key in PromptTemplateTypeEnum]: string };

export class PromptTemplateService {
    private PromptTypeMapper: PromptTypeMapperType = {
        [PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: `Context: {{serializedModelFields}}
Question: {{userInput}}

1. Extract the exact fields names, filters and sorts from the Context in a JSON format that can help answer the Question.
2. The fields are in the format "table.field".
3. If the Question contains a "top", "bottom", insert a "count" inside the fields.
4. Make sure to select the minimum amount of field_names needed to answer the question.
5. Put all the sortings inside sort array
6. field_names only contains a list of field_names with the format "table.field"
7. limit is string and default value is "500" if empty.
8. Filters have the syntax from Looker

JSON output format has only the following keys
{
"field_names": [],
"filters": {},
"sorts": [], 
"limit": "500"
}

Examples:
Q: "What are the top 10 total sales price per brand. With brands: Levi's, Calvin Klein, Columbia"
{"field_names":["products.brand","order_items.total_sale_price"],"filters":{"products.brand":"Levi's, Calvin Klein, Columbia"}, "limit": "10"}

Q: "What are the top sales price, category, cost pivot per day and filter only orders with more than 15 items"
{"field_names":["order_items.total_sale_price", "products.category", "inventory_items.cost", "orders.created_date"], "filters": {"order_items.count": "> 15"}, "sorts": ["order_items.total_sales_price desc"]}

Q: "How many orders were created in the past 7 days"
{"field_names": ["orders.count"], "filters": {"sales_order.created_date": "7 days"}, "sorts": []}

Q: "What are the top 10 languages?"
{"field_names": ["wiki100_m.language","wiki100_m.count"], "filters":{}, "sorts": ["wiki100_m.count desc"], "limit": "10"}

Q: "What are the states that had the most orders, filter state: California, Nevada, Washinton, Oregon"
{"field_names": ["orders.count"], "filters": {"sales_order.state": "California, Nevada, Washington, Oregon"}, "sorts": []}

Q: "What are the top 7 brands that had the most sales price in the last 4 months?"
{"field_names": [ "products.brand", "order_items.total_sale_price" ], "filters": { "order_items.created_date": "4 months" }, "pivots": [], "sorts": ["order_items.total_sale_price desc"], "limit": "7"}        
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

[PromptTemplateTypeEnum.EXPLORATION_OUTPUT]:`Act as an experienced Data Analyst, receiving the raw data the Input Data that is already filtered by the desired period, pivoted and sorted and try to answer the question below as best as you can with only the data provided and in natural language only, no code snippets  allowed.
InputData: {{serializedModelFields}}
Question: {{userInput}}
`,
        [PromptTemplateTypeEnum.DASH_SUMMARIZE]:`Act as an experienced Data Analyst, reading a Dashboard with a Tile Context, the Input Data and answer the Question below. 
Tile Context: {{tileContext}}
InputData: {{serializedModelFields}}
Question: {{userInput}}
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
