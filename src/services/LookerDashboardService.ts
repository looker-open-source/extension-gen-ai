import { IDashboard, IDashboardBase, IDashboardElement, Looker40SDK } from "@looker/sdk";
import { LookerSQLService } from "./LookerSQLService";
import { Logger } from "../utils/Logger"


export type DashboardTile<ElementData> = {
    title?: string | null;
    description?: string | null;
    type?: string | null;
    data: Array<ElementData>,
};


export class LookerDashboardService {
    private lookerSDK: Looker40SDK;
    private lookerSQL: LookerSQLService;

    public constructor(lookerSDK: Looker40SDK, lookerSQL: LookerSQLService) {
        this.lookerSDK = lookerSDK;
        this.lookerSQL = lookerSQL;
    }

    /**
     * Lists all available dashboards using LookerSDK 
     * @returns
     */
    public async listAll(): Promise<IDashboardBase[]> {
        const dashboardsResult = await this.lookerSDK.all_dashboards();
        if (!dashboardsResult.ok) {
            throw new Error('unable to fetch all dashboards');
        }
        return dashboardsResult.value;
    }

    /**
     * Get dashboard data including element list by dashboardId
     * @param dashboardId
     * @returns
     */
    public async getById(dashboardId: string): Promise<IDashboard> {
        const dashboardResponse = await this.lookerSDK.dashboard(dashboardId);
        if (!dashboardResponse.ok) {
            throw new Error('unable to fetch dashboard elements');
        }
        const dashboard: IDashboard = dashboardResponse.value;
        return dashboard;
    }

    /**
     * Fetches DashboardTile with Data of all elements in parallel
     * @param elements
     * @returns
     */
    public async mapElementData<ElementData>(elements: IDashboardElement[]): Promise<Array<DashboardTile<ElementData>>> {
        
        // Filter only visualization elements
        const filteredElements = elements.filter(element => (element.type=="vis" && element.result_maker!=null));        
        const elementDataPromises = filteredElements.map(async (element) => (            
        {            
         title: element.title,
         description: element.subtitle_text,
         type: element.result_maker?.vis_config?.type,         
         data: await this.getElementData<ElementData>(element)
        }));
        const elementDataList: DashboardTile<ElementData>[] = await Promise.all(elementDataPromises);
        return elementDataList;
    }        

    /**
     * Fetches ElementData for a given IDashboardElement
     * @param element
     * @returns
     */
    private async getElementData<ElementData>(element: IDashboardElement): Promise<Array<ElementData>> {
        let queryId = element.query_id;        
        if (queryId == null) {
            if (!element.result_maker?.query_id) {
                Logger.getInstance().debug("Element ID" + element.id +  "does not contain query_id");
                return new Array<ElementData>();
                // throw new Error('unable to find dashboard element query id');
            }
            queryId = element.result_maker.query_id;
        }        
        let elementData: Array<ElementData> = await this.lookerSQL.executeByQueryId<ElementData>(queryId);
        // change the JSON keys/names and also limit the results based on config settings
        if(element.result_maker?.vis_config!=null)
        {
            const vis_config = element.result_maker.vis_config;
            if(vis_config.limit_displayed_rows_values!=null)
            {
                // Slice the Dataset based on the Visualization Settings
                if(vis_config.limit_displayed_rows_values.num_rows!= null)
                {
                    const limited_rows = parseInt(vis_config.limit_displayed_rows_values.num_rows);
                    if (limited_rows!=null) {
                        // TODO: verify if I have to slice from the first_last
                        elementData = elementData.slice(0, limited_rows);       
                        Logger.getInstance().info("Sliced to " + limited_rows + " rows");         
                    }                  
                    else{
                        Logger.getInstance().debug("limiting rows is null");
                    }
                }                
            }    
            // TODO: @gimenes Logic to get field names based on show_x_axis_labels, y_axes.series.axisId and y_axes.label, x_axes..
            const map_axis = new Map<string, string>();
            switch(vis_config.type)
            {
                case "single_value":
                    elementData = elementData.slice(0,1);
                    break;
                case "looker_column":
                    // if(vis_config.show_y_axis_labels)
                    Logger.getInstance().debug("Looker Column");
                    break;
                case "looker_pie":
                    Logger.getInstance().debug("Looker Pie");
                    break;
                case "looker_grid":
                    Logger.getInstance().debug("Looker Grid");
                    // Force slice grid
                    elementData = elementData.slice(0, 50);
                    break;
                default: 
                    Logger.getInstance().debug(vis_config.type);
            }                                                  
        }
        Logger.getInstance().debug("Dashboard Elements: " + element.title + " - " + JSON.stringify(elementData, null, 2));
        return elementData;
    }

    /**
     * Method to clean up Elements (TO BE USED)
     * @param element 
     * @returns 
     */
    private cleanElements(element: IDashboardElement) {
        if(!element.result_maker?.vis_config)
        {
           return;
        }
        const vis_config = element.result_maker.vis_config;
        if(!vis_config.limit_displayed_rows_values) {

        return;
        }
         // slice the dataset based on the visualization settings
        if(!vis_config.limit_displayed_rows_values.num_rows) {        
         return;
        }
        
    }
    
}
