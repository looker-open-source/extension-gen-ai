import { IDashboard, IDashboardElement, Looker40SDK } from "@looker/sdk";
import { LookerSQLService } from "./LookerSQLService";

export class LookerDashboardService {
    private lookerSDK: Looker40SDK;
    private lookerSQL: LookerSQLService;

    public constructor(lookerSDK: Looker40SDK, lookerSQL: LookerSQLService) {
        this.lookerSDK = lookerSDK;
        this.lookerSQL = lookerSQL;
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
     * Fetches ElementData of all elements in parallel
     * @param elements
     * @returns
     */
    public async mapElementData<ElementData>(elements: IDashboardElement[]): Promise<Array<Array<ElementData>>> {
        const elementDataPromises = elements.map((element) => this.getElementData<ElementData>(element));
        const elementDataList: Array<Array<ElementData>> = await Promise.all(elementDataPromises);
        return elementDataList;
    }

    /**
     * Fetches ElementData for a given IDashboardElement
     * @param element
     * @returns
     */
    private async getElementData<ElementData>(element: IDashboardElement): Promise<Array<ElementData>> {
        let queryId = element.query_id;
        if (!queryId) {
            if (!element.result_maker?.query_id) {
                throw new Error('unable to find dashboard element query id');
            }
            queryId = element.result_maker.query_id;
        }
        const elementData: Array<ElementData> = await this.lookerSQL.executeByQueryId<ElementData>(queryId);
        return elementData;
    }
}
