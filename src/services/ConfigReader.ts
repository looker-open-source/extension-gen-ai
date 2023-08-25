import { LookerSQLService } from "./LookerSQLService";
import { Looker40SDK } from "@looker/sdk";

export interface TopPrompts {
    description: string;
    prompt: string;
    modelExplore: string;
}
export class ConfigReader {
    public static readonly CurrentVersion = "1.2";
    public static readonly LastUpdated = "08/24/2023";
    public static readonly DefaultDataset = "llm";
}   
