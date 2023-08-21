import { IDashboard, IDashboardBase, IDashboardElement, Looker40SDK } from "@looker/sdk";
import { UtilsHelper } from "../utils/Helper";
import { DashboardTile, LookerDashboardService } from "./LookerDashboardService";
import { LookerSQLService } from "./LookerSQLService";
import { PromptService, PromptTypeEnum } from "./PromptService";



export class GenerativeDashboardService {
    private sql: LookerSQLService;
    private dashboardService: LookerDashboardService;    
    private promptService: PromptService|null = null;

    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
        this.dashboardService = new LookerDashboardService(lookerSDK, this.sql);        
    }

    // Change this variable if you want to change the ML model from BQML
    static readonly BQML_DATASET: string = "llm.llm_model";
    static readonly MAX_CHAR_PER_PROMPT: number = 8000*3;
    static readonly MAX_CHAR_PER_TILE: number = 6000*3;
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
    public getPromptService(): PromptService
    {
        if(this.promptService==null)
        {
            this.promptService = new PromptService();
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
        // console.log("Dashboard Elements: " + JSON.stringify(elements, null, 2));
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
        const arrayPromisesSummarizer: Array<Promise<string>> = [];
        // Summarize Tiles
        dashboardElementData.elements.map((dashTile) => {
            const tileData = dashTile.data;
            const tileLength = JSON.stringify(tileData).length;
            // console.log("Tile Length: " + tileLength + " - Tile Name: "+ dashTile.title! + "- Tile Type: " + dashTile.type);
            // console.log("Data: " + JSON.stringify(tileData, null, 2));
            
            if( tileLength > GenerativeDashboardService.MAX_CHAR_PER_TILE)
            {                
                console.log("Limit of Element Data per Tile to be summarizable");
                arrayTilesNotSummarizable.push(dashTile);
            }
            else if (tileLength> GenerativeDashboardService.MIN_SUMMARIZE_CHAR_PER_TILE)
            {
                // Summarize
                console.log("Summarize this tile");
                arrayPromisesSummarizer.push()
            }
            else
            {
                console.log("Sending as IS");
                arrayTiles.push(dashTile);
            }
        });
                        
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

        this.getPromptService().fillPromptVariables(PromptTypeEnum.DASH_SUMMARIZE, { dashBoardContext, userInput, serializedModelFields, tileContext})
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
        if (serializedElementData.length > GenerativeDashboardService.MAX_CHAR_PER_PROMPT)
        {
            serializedElementData = await this.shardDashboardData(dashboardElementData, question);
        }
        // Clean string to send to BigQuery
        serializedElementData = serializedElementData.replace(/\'/g, '\\\'');
        console.log("Sending Prompt to BigQuery LLM");
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
            MODEL `+ GenerativeDashboardService.BQML_DATASET +`,
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







