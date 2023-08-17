import { IRequestRunQuery, ISqlQueryCreate, IWriteQuery, Looker40SDK } from "@looker/sdk";

export class LookerSQLService {
    private lookerSDK: Looker40SDK;
    private readonly connectionName = "dataml-latam-argolis"; // TODO remove hard coded variable

    public constructor(lookerSDK: Looker40SDK) {
       this.lookerSDK = lookerSDK;
    }

    /**
     * Executes a Query and fetches results using LookerSDK
     * @param query
     * @returns
     */
    public async execute<T>(query: string): Promise<Array<T>> {
        const queryCreate: ISqlQueryCreate = {
            connection_name: this.connectionName,
            sql: query,
        }
        const result = await this.lookerSDK.create_sql_query(queryCreate);
        if (!result.ok) {
            throw new Error('unable to create SQL query');
        }
        if (!result.value.slug) {
            throw new Error('invalid SQL query results. Missing slug');
        }
        const slug: string = result.value.slug;
        return await this.runQuerySlug<T>(slug);
    }

    /**
     * Runs a Query calling LookerSDK using queryId
     * @param queryId
     * @returns
     */
    public async executeByQueryId<T>(queryId: string): Promise<Array<T>> {
        const runQueryRequest: IRequestRunQuery = {
            query_id: queryId,
            result_format: "json"
        };
        const queryResult = await this.lookerSDK.run_query(runQueryRequest);
        if (!queryResult.ok) {
            throw new Error('unable to execute query by id');
        }
        if (!Array.isArray(queryResult.value)) {
            throw new Error('invalid query result value type');
        }
        return queryResult.value;
    }

    /**
     * Retrieves a Query result calling LookerSDK using slug
     * @param slug
     * @returns
     */
    private async runQuerySlug<T>(slug: string): Promise<Array<T>>
    {
        const result = await this.lookerSDK.run_sql_query(slug, "json");
        if (!result.ok) {
            throw new Error('unable to run SQL query');
        }
        return result.value as unknown as Array<T>;
    }

    /**
     * Creates a new WriteQuery calling LookerSDK
     * @param query
     * @returns
     */
    public async createQuery(query: Partial<IWriteQuery>) {
        const result = await this.lookerSDK.create_query(query);
        if (!result.ok) {
            throw new Error('invalid create query result')
        }
        return result;
    }
}
