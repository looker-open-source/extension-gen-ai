/**
 * Copyright (c) 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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