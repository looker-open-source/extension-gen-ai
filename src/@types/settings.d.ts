import { ComboboxOptionObject } from "@looker/components";
import PromptModel from "../models/PromptModel";

export interface ISettings {
    userId: string;
    logLevel: string;
    customPrompt: string;
    llmModelSize: string;
    useNativeBQ: string;
}
export type StateContextType = {
  configSettings: ISettings;
  saveSettings: (set: ISettings) => Promise<void>;
  resetSettings: () => Promise<ISettings>;
  setExploreCurrentComboModels: (models: ComboboxOptionObject[]) => void;
  setSelectedModelExplore:(exp:string) => void;
  setPrompt:(prompt:string) => void;
  exploreComboModels: ComboboxOptionObject[];
  exploreComboPromptExamples: ComboboxOptionObject[];
  explorePromptExamples: PromptModel[];
  exploreCurrentComboModels:ComboboxOptionObject[];
  selectedModelExplore:string;
  dashboardCombo: ComboboxOptionObject[];
  prompt:string;
  userId: string;
  setLlmModelSize:(size:string) => void;
  llmModelSize:string;
  setCheckUseNativeBQ:(useNativeBQ:boolean) => void;
  checkUseNativeBQ:boolean;
};
