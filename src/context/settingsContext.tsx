import * as React from 'react';
import  { useState } from 'react';
import { StateContextType, ISettings } from '../@types/settings';
import { ExtensionContext } from '@looker/extension-sdk-react';
import { ConfigReader } from '../services/ConfigReader';
import { setConfig } from 'react-hot-loader';
import { ComboboxOptionObject, Dialog, DialogLayout, Space, Spinner } from '@looker/components';
import { PromptService } from '../services/PromptService';
import { IDashboardBase, ILookmlModel, IRequestAllLookmlModels, IUser } from '@looker/sdk';
import PromptModel from '../models/PromptModel';
import { DashboardService } from '../services/DashboardService';
import { Logger } from '../utils/Logger';

export const StateContext = React.createContext<StateContextType | null>(null);

const StateProvider: React.FC<React.ReactNode> = ({ children }) => {    

  
  const { core40SDK } =  React.useContext(ExtensionContext);
  const configReader: ConfigReader = new ConfigReader(core40SDK);
  const promptService = new PromptService(core40SDK);
  const dashboardService = new DashboardService(core40SDK);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [configSettings, setConfigSettings] = useState<ISettings>({"userId":"", "customPrompt": "default", "logLevel": "info"});
  
  // Explores
  const [exploreComboModels, setExploreComboModels] = useState<ComboboxOptionObject[]>([]);
  const [exploreCurrentComboModels, setExploreCurrentComboModels] = useState<ComboboxOptionObject[]>([]);
  const [exploreComboPromptExamples, setExploreComboPromptExamples] = useState<ComboboxOptionObject[]>([]); 
  const [explorePromptExamples, setExplorePromptExamples ] = useState<PromptModel[]>([]);
  const [selectedModelExplore, setSelectedModelExplore] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
 
  // Dashboards
  const [dashboardCombo, setDashboardCombo ] = useState<ComboboxOptionObject[]>([]);
  const [isMounted, setIsMounted] = useState(false);



  React.useEffect(() => {    
    loadState();    
  }, []);

  // save settings
  const saveSettings = async (set: ISettings) => {
    setIsLoading(true);        
    await configReader.updateSettings(set, userId);
    setConfigSettings(set);    
    setIsLoading(false);
  }

  // load overall states
  const loadState = async () => {
    setIsLoading(true);
    
    const lookerElementsPromise  = loadLookerElements();
    const [lookerElements] = await Promise.all([lookerElementsPromise]);
  
    //Create Combo objects for Explores
    loadComboExplore(lookerElements[0], lookerElements[1]);    
    //Create combo for Dashboards
    generateComboDashboards(lookerElements[2]);
    // set user id
    setUserId(lookerElements[3].id!);
    
    const settings = await loadSettings(lookerElements[3].id!);
    setConfigSettings(settings);
     // Create settings
    Logger.debug("settings loaded: " + settings.logLevel);
    setIsLoading(false);
    // loadDashboardCombo();
    setIsMounted(true);
  }

  const loadLookerElements = async (): Promise<[ILookmlModel[], PromptModel[], IDashboardBase[], IUser]> => {

    const req: IRequestAllLookmlModels = {
      fields : "name, explores"
    }
    const modelsPromise = core40SDK.ok(core40SDK.all_lookml_models(req));
    const promptPromise = promptService.getExplorePrompts();
    const userIdPromise = core40SDK.ok(core40SDK.me());         
    const dashboardPromise = dashboardService.listAll();
    return Promise.all([modelsPromise ,promptPromise, dashboardPromise, userIdPromise]);    
  }


  function loadComboExplore(models: ILookmlModel[], prompts: PromptModel[]) {
    
    setExploreComboModels(generateComboExploreFromModels(models));    
    setExplorePromptExamples(prompts);
    setExploreComboPromptExamples(generateCombosForTopPrompts(prompts));
  }

  function generateComboDashboards(listDashs: IDashboardBase[]) {
    // sort the dashboards on the combo
    const listSortedDashs = listDashs.sort((a:IDashboardBase,b:IDashboardBase) => (a.title!=null&&b.title!=null)?a.title.localeCompare(b.title):0);
    const comboObjects: ComboboxOptionObject[] = listSortedDashs
      .map(({ title, id }) => ({
          label: [title, id].join(' - '),
          value: [title, id].join('.')
      }));
    setDashboardCombo(comboObjects);    
  }

  function generateCombosForTopPrompts(prompts: Array<PromptModel>) {
    var allValues:ComboboxOptionObject[] = [];
    prompts.forEach(promptModel => {
      allValues.push({
        label: promptModel.description,
        value: promptModel.modelExplore + "@@@" + promptModel.prompt
      });                
    });
    return allValues;
  }

  function generateComboExploreFromModels(listModels: ILookmlModel[]) {
    const sortedModels = listModels.sort((a:ILookmlModel,b:ILookmlModel) => (a.name!=null&&b.name!=null)?a.name.localeCompare(b.name):0)
    var allValues:ComboboxOptionObject[] = [];
    sortedModels.forEach(model => {
      model.explores?.forEach(explore => {
        if( model!=null && explore!=null)
        {          
          const exp = {
            label: model.name + " - " + explore.name,
            value: model.name + "." + explore.name  
          };
          // @ts-ignore
          allValues.push(exp);
        }        
      })
    });
    return allValues;
  }


  const loadSettings: (userIdFromConfig: string) => Promise<ISettings> = async (userIdFromConfig: string) =>  {    
    const conf = await configReader.getSettings(userIdFromConfig)!;
    setConfigSettings(conf);    
    return conf;
  }
  
  const resetSettings: () => Promise<ISettings> = async () => {    
    setIsLoading(true);
    await configReader.resetDefaultSettings(userId);
    const config = await loadSettings(userId);
    setIsLoading(false);  
    return config;
  }
  
 return (
    <StateContext.Provider value={{configSettings, saveSettings,resetSettings, 
    setExploreCurrentComboModels, setSelectedModelExplore, exploreComboModels,
    explorePromptExamples, exploreComboPromptExamples, exploreCurrentComboModels, 
    selectedModelExplore, prompt, setPrompt,
    dashboardCombo, userId}}>
      {isMounted && children}
      <Dialog isOpen={isLoading} width={350} >
        <DialogLayout header="Loading Extension...">
          <Space>
          <Spinner size={80}>
          </Spinner>
          </Space>
        </DialogLayout>            
      </Dialog>
    </StateContext.Provider>
  );
};

export default StateProvider;