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