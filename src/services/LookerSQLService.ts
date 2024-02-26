/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { IQuery, IRequestRunQuery, ISqlQueryCreate, IWriteQuery, Looker40SDK, sql_query } from "@looker/sdk";
import {ITransportSettings} from "@looker/sdk-rtl";
import { Logger } from "../utils/Logger";

export class LookerSQLService {
    private lookerSDK: Looker40SDK;
    private connectionName: string = "";

    public constructor(lookerSDK: Looker40SDK) {
       this.lookerSDK = lookerSDK;       
    }

    private static transportTimeoutCustom: Partial<ITransportSettings> = 
    {
        timeout: 600000
    };

    private async getCurrentConnectionName(): Promise<string>
    {
        if(this.connectionName == "")
        {
            // TODO: try to get dynamically the looker-genai modelName    
            let response = await this.lookerSDK.ok(this.lookerSDK.lookml_model('looker-genai'));
            if(response.allowed_db_connection_names!=null && response.allowed_db_connection_names.length > 0)
            {
                this.connectionName = response.allowed_db_connection_names[0];
            }
            else
            {
                throw new Error("Problem getting the Dynamic DB connection to Run Queries");
            }
        } 
        return this.connectionName; 
    }

    public async executeLog(query: string): Promise<string> {
              
        const queryCreate: ISqlQueryCreate = {
            connection_name: await this.getCurrentConnectionName(),
            sql: query,
        }        
        const result = await this.lookerSDK.create_sql_query(queryCreate, LookerSQLService.transportTimeoutCustom);        
        if (!result.ok) {
            Logger.debug('unable to execute Log: ' + query);
            return "error - not able to execute Log";
        }
        if (!result.value.slug) {
            Logger.debug('Invalid Log Results. Missing slug');
            return "error - no slug";
        }
        const slug: string = result.value.slug;
        return await this.runLogSlug(slug);
    }

    /**
     * Executes a Query and fetches results using LookerSDK
     * @param query
     * @returns
     */
    public async execute<T>(query: string): Promise<Array<T>> {
               
        const queryCreate: ISqlQueryCreate = {
            connection_name: await this.getCurrentConnectionName(),
            sql: query,
        }        
        const result = await this.lookerSDK.create_sql_query(queryCreate, LookerSQLService.transportTimeoutCustom);        
        if (!result.ok) {
            throw new Error('unable to create SQL query: ' + query);
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
        const queryResult = await this.lookerSDK.run_query(runQueryRequest, LookerSQLService.transportTimeoutCustom);
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
        
        const result = await this.lookerSDK.run_sql_query(slug, "json",undefined,LookerSQLService.transportTimeoutCustom);
        if (!result.ok) {
            throw new Error('unable to run SQL query');
        }
        return result.value as unknown as Array<T>;
    }

    /**
     * Retrieves a Query result calling LookerSDK using slug
     * @param slug
     * @returns
     */
    private async runLogSlug(slug: string):Promise<string>
    {        
        const result = await this.lookerSDK.run_sql_query(slug, "txt", undefined,LookerSQLService.transportTimeoutCustom);
        if (!result.ok) {
            Logger.error('unable to run Log slug query');            
        }
        return "";
    }


    /**
     * Creates a new WriteQuery calling LookerSDK
     * @param query
     * @returns
     */
    public async createQuery(query: Partial<IWriteQuery>) {
        const result = await this.lookerSDK.create_query(query, undefined , LookerSQLService.transportTimeoutCustom);
        if (!result.ok) {
            throw new Error('invalid create query result')
        }
        return result;
    }

    public async getQueryFromId(slug:string): Promise<IQuery>
    {
        const result = await this.lookerSDK.query(slug);
        if (!result.ok) {
            throw new Error('invalid get query from id result')
        }
        debugger;
        console.log(result.value);
        return result.value;
    }

}
