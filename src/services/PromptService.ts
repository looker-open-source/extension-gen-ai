/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { Looker40SDK } from "@looker/sdk";
import { PromptRepository } from "../databases/PromptRepository";

export class PromptService {

    private dbService: PromptRepository;

    public constructor(lookerSDK: Looker40SDK) {
        this.dbService = new PromptRepository(lookerSDK);
    }

    public getExplorePrompts()
    {
        return this.dbService.getTopExplorePrompts();
    }
}