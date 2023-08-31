import { IDashboard, IDashboardBase, IDashboardElement, Looker40SDK } from "@looker/sdk";
import { UtilsHelper } from "../utils/Helper";
import { DashboardTile, LookerDashboardService } from "./LookerDashboardService";
import { LookerSQLService } from "./LookerSQLService";
import { PromptTemplateService, PromptTemplateTypeEnum } from "./PromptTemplateService";
import { Logger } from "../utils/Logger"
import { ConfigReader } from "./ConfigReader";



export class DashboardService {
    private sql: LookerSQLService;
    private dashboardService: LookerDashboardService;    
    private promptService: PromptTemplateService|null = null;

    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
        this.dashboardService = new LookerDashboardService(lookerSDK, this.sql);        
    }
    
    static readonly MAX_CHAR_PER_PROMPT: number = 8000*3;
    static readonly MAX_CHAR_PER_TILE: number = 15000*3;
    static readonly MIN_SUMMARIZE_CHAR_PER_TILE: number = 2000*3;

    /**
     * Lists all available dashboards
     * @returns
     */
    public async listAll(): Promise<IDashboardBase[]> {
        return await this.dashboardService.listAll();
    }

    /**
     * Method that gets the current PromptService - Lazy load
     * @returns 
     */
    public getPromptService(): PromptTemplateService
    {
        if(this.promptService==null)
        {
            this.promptService = new PromptTemplateService();
        }
        return this.promptService;
    }


    /**
     * Get Dashboard Elements using dashboardId
     * @param dashboardId 
     * @returns 
     */    
    public async getDashboardDataById<ElementData>(dashboardId: string): Promise<{
        title?: string,
        description?: string,
        elements: Array<DashboardTile<ElementData>>
            }> {
        const dashboard: IDashboard = await this.dashboardService.getById(dashboardId);
        if (!dashboard.dashboard_elements) {
        throw new Error('invalid dashboard element fetch result');
        }
        const elements: IDashboardElement[] = dashboard.dashboard_elements;
        if (elements.length === 0) {
        throw new Error('dashboard does not contain any elements');
        }
        // Debug:        
        // Logger.debug("Dashboard Elements: " + JSON.stringify(elements, null, 2));
        const elementsData: Array<DashboardTile<ElementData>> = await this.dashboardService.mapElementData<ElementData>(elements);

        const { title, description } = dashboard;        
        return {
        title:title!,
        description: description!,
        elements: elementsData,
        };
    }

    public async shardDashboardData(
        dashboardElementData:
        {
            title?: string,
            description?: string,
            elements: Array<DashboardTile<unknown>>
        } ,
        question: string): Promise<string> {
        
        const arrayTilesNotSummarizable: Array<DashboardTile<unknown>> = [];
        const arrayTiles: Array<DashboardTile<unknown>> = [];
        const arrayPromisesSummarizer: Array<Promise<DashboardTile<unknown>>> = [];
        // Summarize Tiles
        dashboardElementData.elements.map((dashTile) => {
            const tileData = dashTile.data;
            const tileLength = JSON.stringify(tileData).length;            
            Logger.debug("Tile Length: "+ tileLength);
            if( tileLength > DashboardService.MAX_CHAR_PER_TILE)
            {                
                Logger.trace("Limit of Element Data per Tile to be summarizable");
                arrayTilesNotSummarizable.push(dashTile);
            }
            else if (tileLength> DashboardService.MIN_SUMMARIZE_CHAR_PER_TILE)
            {
                // Summarize
                Logger.trace("Summarize this tile: " + dashTile.title);
                arrayPromisesSummarizer.push(
                    this.summarizeTile(dashTile, question,
                         dashboardElementData.title, dashboardElementData.description));
            }
            else
            {
                Logger.trace("Sending as IS");
                arrayTiles.push(dashTile);
            }
        });
        
        const arraySummarized = await Promise.all(arrayPromisesSummarizer);
        arrayTiles.concat(arraySummarized);                                
        const tilesToSend = {
            title: dashboardElementData.title,
            description: dashboardElementData.description,
            elements: arrayTiles
        }        
        return  JSON.stringify(tilesToSend);         
    }

    public async summarizeTile(
        tile: DashboardTile<unknown>,
        question: string,
        title?: string,
        description?: string        
    )
    {
        const dashBoardContext = title!=null? "Dashboard Title: " + title: "" +
         description!=null? " Dash Description: "+ description: "";

        const userInput = question;
        const serializedModelFields = JSON.stringify(tile.data);
        const tileContext = tile.title!= null? "Tile Title: " + tile.title: "" +
        tile.description!=null? " Tile Description: " + tile.description: "";

        const promptSumarize = this.getPromptService().fillByType(PromptTemplateTypeEnum.DASH_SUMMARIZE, { dashBoardContext, userInput, serializedModelFields, tileContext});
        const summaryResult = await this.sendPromptToBigQuery(promptSumarize);
        try {
            tile.data = JSON.parse(summaryResult);
            return tile;
        }
        catch (error)
        {
            Logger.debug(error);
            throw new Error("unable to summarize: Could not parse JSON from BQ LLM");            
        }                         
    }


    
    /**
     * Sends prompt with dashboard data & question to LLM using BigQuery
     * @param dashboardElementData
     * @param question
     * @returns
     */
    public async sendPrompt(
        dashboardElementData:
        {
            title?: string,
            description?: string,
            elements: Array<DashboardTile<unknown>>
        } ,
        question: string): Promise<string> {
        // Fix some characters that breaks BigQuery Query
        let serializedElementData = JSON.stringify(dashboardElementData);            
        if (serializedElementData.length > DashboardService.MAX_CHAR_PER_PROMPT)
        {
            serializedElementData = await this.shardDashboardData(dashboardElementData, question);
        }
        // Clean string to send to BigQuery
        serializedElementData = serializedElementData.replace(/\'/g, '\\\'');
        Logger.debug("Sending Prompt to BigQuery LLM");
        const singleLineString = `Act as an experienced Business Data Analyst with PHD and answer the question having into context the following Data: ${serializedElementData} Question: ${question}`;                
        return this.sendPromptToBigQuery(singleLineString);        

    }

    /**
     * 
     * Method to send the Prompt to BigQuery using sql service
     * @param promptParameter 
     * @returns 
     */
    public async sendPromptToBigQuery(promptParameter: string){
        // Create SQL Query to
        const query = `SELECT ml_generate_text_llm_result as r, ml_generate_text_status
        FROM
        ML.GENERATE_TEXT(
            MODEL `+ ConfigReader.BQML_MODEL +`,
            (
            SELECT '`+ promptParameter + `' AS prompt
            ),
            STRUCT(
            0.2 AS temperature,
            1024 AS max_output_tokens,
            0.95 AS top_p,
            TRUE AS flatten_json_output,
            40 AS top_k));
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







