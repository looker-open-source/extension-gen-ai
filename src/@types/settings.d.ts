import { ILookmlModel } from "@looker/sdk";
import PromptModel from "../models/PromptModel";
import { ComboboxOptionObject } from "@looker/components";

export interface ISettings {
    userId: string;
    logLevel: string;
    customPrompt: string;
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
};