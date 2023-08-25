import { Looker40SDK } from "@looker/sdk";
import { LookerSQLService } from "./LookerSQLService";
import { PromptDb } from "../databases/PromptDb";

export class PromptService {

    private dbService: PromptDb;

    public constructor(lookerSDK: Looker40SDK) {
        this.dbService = new PromptDb(lookerSDK);
    }

    public getExplorePrompts()
    {
        return this.dbService.getTopExplorePrompts();
    }
}