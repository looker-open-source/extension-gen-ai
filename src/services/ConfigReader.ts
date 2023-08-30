import { LookerSQLService } from "./LookerSQLService";
import { Looker40SDK } from "@looker/sdk";

export interface TopPrompts {
    description: string;
    prompt: string;
    modelExplore: string;
}
export class ConfigReader {
    public static readonly CURRENT_VERSION = "1.2";
    public static readonly LAST_UPDATED = "08/24/2023";
    public static readonly DEFAULT_DATASET = "llm";
    public static readonly BQML_MODEL = "llm.llm_model";
}   
