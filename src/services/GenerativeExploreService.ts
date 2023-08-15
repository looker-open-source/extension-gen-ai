import { ILookmlModelExploreField, ISqlQueryCreate, IWriteQuery, Looker40SDK } from "@looker/sdk";
import { UtilsHelper } from "../utils/Helper";
import { LookerSQLService } from "./LookerSQLService";

export class GenerativeExploreService {
    private sql: LookerSQLService;

    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
    }

    public generatePrompt(
        modelFields: ILookmlModelExploreField[],
        modelName: string,
        viewName: string,
        userInput: string) {
        const serializedModelFields = JSON.stringify(modelFields);
        const generatedPrompt = `
Write a simple JSON body for Looker LLM application.
Make sure to use the following 3 rules:
1. The JSON has a structure of model (string), view(string), fields(array of strings), filters(array of strings), sorts(array of strings), pivots(array of strings), limit(int).
2. All the fields, sorts, pivots need to be in the dictionary provided for the input.
3. Use syntax compatible with Looker matching filters with data types.

Here are some generic examples that uses a example_input_dictionary with model: "bi_engine_demo" and view: "wiki100_m", so you can learn how does it works:
example_input_dictionary : [{"label":"Wiki100 M Day","field":"wiki100_m.day","description":""},{"label":"Wiki100 M Language","field":"wiki100_m.language","description":""},{"label":"Wiki100 M Month","field":"wiki100_m.month","description":""},{"label":"Wiki100 M Title","field":"wiki100_m.title","description":""},{"label":"Wiki100 M Views","field":"wiki100_m.views","description":""},{"label":"Wiki100 M Wikimedia Project","field":"wiki100_m.wikimedia_project","description":""},{"label":"Wiki100 M Year","field":"wiki100_m.year","description":""},{"label":"Wiki100 M Count","field":"wiki100_m.count","description":""}]

input: What are the top 10 languages?
output: {"model": "bi_engine_demo", "view": "wiki100_m", "fields": ["wiki100_m.count", "wiki100_m.language"], "filters": null, "sorts": ["wiki100_m.count desc"], "pivots": null, "limit": "10"}

input: count per language in year 2023
output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language","wiki100_m.year"],"filters": { "wiki100_m.year": "2023"}, "sorts": [],"pivots": null,"limit": "500"}

input: count per language pivot per year order by year desc
output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language","wiki100_m.year"],"filters": null, "sorts": ["wiki100_m.year desc],"pivots": ["wiki100_m.year"],"limit": "500"}

input:  What is the count per language, year, considering the folowing languages: en,pt,es?
output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language", "wiki100_m.year"],"filters": {"wiki100_m.language": "en,fr,es"}, "sorts": null,"pivots": ["wiki100_m.year"],"limit": "500"}

Now, generate the output with model: ${modelName} and view: "${viewName}".
Make sure to use data from the input_dictionary to select filters, sorts and pivots.
input_dictionary : ${serializedModelFields}
Input: ${userInput}
`
        return generatedPrompt;
    }

    public async sendPromptToBigQuery(promptToSend: string): Promise<{
        queryId: string,
        modelName: string,
        view: string,
    }> {
        const singleLineString = UtilsHelper.escapeBreakLine(promptToSend);
        console.log("Sending Prompt to BigQuery LLM");
        const query = `SELECT llm.bq_vertex_remote('`+ singleLineString + `') AS llm_result`;
        console.log("Query to Run: " + query);
        const result = await this.sql.execute<{
            llm_result: string
        }>(query);
        const firstRow = UtilsHelper.firstElement(result);
        const llmResultString: string = firstRow.llm_result;
        let llmQuery: IWriteQuery;
        try {
            llmQuery = JSON.parse(llmResultString);
        } catch (err) {
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
