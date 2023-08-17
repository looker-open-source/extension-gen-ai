import { IDashboard, IDashboardBase, IDashboardElement, Looker40SDK } from "@looker/sdk";
import { UtilsHelper } from "../utils/Helper";
import { LookerDashboardService } from "./LookerDashboardService";
import { LookerSQLService } from "./LookerSQLService";

export class GenerativeDashboardService {
    private sql: LookerSQLService;
    private dashboardService: LookerDashboardService;

    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
        this.dashboardService = new LookerDashboardService(lookerSDK, this.sql);
    }

    /**
     * Lists all available dashboards
     * @returns
     */
    public async listAll(): Promise<IDashboardBase[]> {
        return await this.dashboardService.listAll();
    }

    /**
     * Get Dashboard Elements using dashboardId
     * @param dashboardId
     * @returns
     */
    public async getElementsById<ElementData>(dashboardId: string): Promise<Array<Array<ElementData>>> {
        const dashboard: IDashboard = await this.dashboardService.getById(dashboardId);
        if (!dashboard.dashboard_elements) {
            throw new Error('invalid dashboard element fetch result');
        }
        const elements: IDashboardElement[] = dashboard.dashboard_elements;
        if (elements.length === 0) {
            throw new Error('dashboard does not contain any elements');
        }
        const elementsData: Array<Array<ElementData>> = await this.dashboardService.mapElementData<ElementData>(elements);
        return elementsData;
    }

    /**
     * Sends prompt with dashboard data & question to LLM using BigQuery
     * @param dashboardElementData
     * @param question
     * @returns
     */
    public async sendPrompt(dashboardElementData: Array<Array<unknown>>, question: string): Promise<string> {
        // Fix some characters that breaks BigQuery Query
        const serializedElementData = JSON.stringify(dashboardElementData)
            .replace(/\'/g, '\\\'');

        console.log("Sending Prompt to BigQuery LLM");
        const singleLineString = `Act as an experienced Business Data Analyst with PHD and answer the question having into context the following Data: ${serializedElementData} Question: ${question}`;

        const query = `SELECT ml_generate_text_llm_result as r, ml_generate_text_status
        FROM
        ML.GENERATE_TEXT(
            MODEL llm.llm_model,
            (
            SELECT '`+ singleLineString + `' AS prompt
            ),
            STRUCT(
            0.1 AS temperature,
            1024 AS max_output_tokens,
            0.1 AS top_p,
            TRUE AS flatten_json_output,
            10 AS top_k));
        `;
        const queryResults = await this.sql.execute<{
            r: string
            ml_generate_text_status: string
        }>(query);
        // Create SQL Query to Run
        var firstResult = UtilsHelper.firstElement(queryResults);
        if (!firstResult.r) {
            const generateTextStatus = firstResult.ml_generate_text_status
            if (!generateTextStatus) {
                throw new Error('generated llm result does not contain expected colums');
            }
            throw new Error('generated llm result contains errors: ' + generateTextStatus);
        }
        return firstResult.r;
    }
}
