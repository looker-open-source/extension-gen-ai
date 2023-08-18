export enum PromptTypeEnum {
    FIELDS_FILTERS_PIVOTS_SORTS,
    LIMITS    
}

export type PromptTypeMapperType = { [key in PromptTypeEnum]: string };

export class PromptService {
    private PromptTypeMapper: PromptTypeMapperType = {
        [PromptTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: `Context: {{serializedModelFields}}
Question: {{userInput}}

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
`,
        [PromptTypeEnum.LIMITS]: `
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
    };
    
    public constructor(customPrompts?: Partial<PromptTypeMapperType>) {
        console.log("Constructor of PromptService");    
        customPrompts = customPrompts || {};
        this.PromptTypeMapper = {            
            ...this.PromptTypeMapper,
            ...customPrompts
        };
    }

    public getPromptTemplateByType(promptType:PromptTypeEnum): string
    {
        return this.PromptTypeMapper[promptType];
    }

    public fillPromptVariables(promptType: PromptTypeEnum, promptVariableContext: { [key: string]: string}): string {
        let replacedPrompt = this.PromptTypeMapper[promptType];
        Object.keys(promptVariableContext).forEach((key) => {
            replacedPrompt = replacedPrompt.replace(`{{${key}}}`, promptVariableContext[key]);
        })
        return replacedPrompt;
    }

}