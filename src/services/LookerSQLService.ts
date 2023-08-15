import { ISqlQueryCreate, IWriteQuery, Looker40SDK } from "@looker/sdk";

export class LookerSQLService {
    private lookerSDK: Looker40SDK;
    private readonly connectionName = "PROJECT_ID"; // TODO remove hard coded variable


    public constructor(lookerSDK: Looker40SDK) {
       this.lookerSDK = lookerSDK;
    }

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

    private async runQuerySlug<T>(slug: string): Promise<Array<T>>
    {
        const result = await this.lookerSDK.run_sql_query(slug, "json");
        if (!result.ok) {
            throw new Error('unable to run SQL query');
        }
        return result.value as unknown as Array<T>;
    }

    public async createQuery(query: Partial<IWriteQuery>) {
        const result = await this.lookerSDK.create_query(query);
        if (!result.ok) {
            throw new Error('invalid create query result')
        }
        return result;
    }
}
