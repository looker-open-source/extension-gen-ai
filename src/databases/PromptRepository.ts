/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import PromptModel, { IPromptModel } from "../models/PromptModel";
import { LookerSQLService } from "../services/LookerSQLService";
import { Looker40SDK } from "@looker/sdk";


export class PromptRepository{

    private sql: LookerSQLService;
    
    public constructor(lookerSDK: Looker40SDK) {
        this.sql = new LookerSQLService(lookerSDK);
    }

    public async getTopExplorePrompts(): Promise<Array<PromptModel>>
    {
        const queryGetExplorePrompts = "SELECT description, prompt, model_explore as modelExplore FROM llm.explore_prompts";
        const topPromptResults = await this.sql.execute<IPromptModel>(queryGetExplorePrompts);
        const promptModels: Array<PromptModel> = topPromptResults.map(row =>  new PromptModel(row)); 
        return promptModels;        
    }


}