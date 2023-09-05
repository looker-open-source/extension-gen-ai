// Copyright 2023 Google LLC

import React, { useContext, useEffect, useState , FormEvent, useCallback} from 'react'
import { 
  Button, 
  ComponentsProvider,
  FieldTextArea,
  Space,
  Span,
  SpaceVertical,
  Spinner,
  FieldSelect, 
  ComboboxOptionObject,
  ComboboxCallback,
  MaybeComboboxOptionObject
} from '@looker/components'
import { Dialog, DialogLayout} from '@looker/components'
import { ExtensionContext , ExtensionContextData } from '@looker/extension-sdk-react'
import { 
  IRequestAllLookmlModels,
  ILookmlModel,
  ISqlQueryCreate,
  ILookmlModelExploreFieldset,
  ILookmlModelExploreField
} from '@looker/sdk'
import { Box, Heading } from '@looker/components'
import { EmbedContainer } from './EmbedContainer'
import { ExploreEvent, LookerEmbedSDK} from '@looker/embed-sdk'
import { ExploreService, FieldMetadata } from '../services/ExploreService'
import { PromptTemplateService } from '../services/PromptTemplateService'
import { Logger } from '../utils/Logger'
import { ConfigReader } from '../services/ConfigReader'
import { PromptService } from '../services/PromptService'
import PromptModel from '../models/PromptModel'
/**
 * Looker GenAI - Explore Component
 */
export const Explore: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const [message, setMessage] = useState('')
  const [loadingLookerModels, setLoadingLookerModels] = useState<boolean>(false)
  const [loadingLLM, setLoadingLLM] = useState<boolean>(false)
  const [lookerModels, setLookerModels] = useState<ILookmlModel[]>([])
  const [errorMessage, setErrorMessage] = useState<string>()
  const [allComboExplores, setAllComboExplores] = useState<ComboboxOptionObject[]>()  
  const [currentComboExplores, setCurrentComboExplores] = useState<ComboboxOptionObject[]>()
  const [selectedModelExplore, setSelectedModelExplore] = useState<string>()
  const [currentModelName, setCurrentModelName] = useState<string>()
  const [currentExploreName, setCurrentExploreName] = useState<string>()
  const [prompt, setPrompt] = useState<string>()
  const [currentExploreId, setCurrentExploreId] = useState<string>()
  const [exploreDivElement, setExploreDivElement] = useState<HTMLDivElement>()
  const [hostUrl, setHostUrl] = useState<string>()

  const [topPromptsCombos, setTopPromptsCombos] = useState<ComboboxOptionObject[]>()
  const [topPrompts, setTopPrompts] = useState<PromptModel[]>([])

  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  const promptService: PromptService = new PromptService(core40SDK);

  useEffect(() => {
    loadExplores();
    setShowInstructions(window.sessionStorage.getItem("showInstructions")==='true' || window.sessionStorage.getItem("showInstructions")==null)
  ;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // set Initial Combo Explore and All
    setAllComboExplores(allValues);
    setCurrentComboExplores(allValues);    
  }

  function generateCombosForTopPrompts(prompts: Array<PromptModel>) {
    var allValues:ComboboxOptionObject[] = [];
    prompts.forEach(promptModel => {
      allValues.push({
        label: promptModel.description,
        value: promptModel.modelExplore
      });                
    });
    setTopPromptsCombos(allValues);
  }

  const loadExplores = async () => {    
    setLoadingLLM(true);
    setLoadingLookerModels(true);
    setErrorMessage(undefined);
    try {
      const req: IRequestAllLookmlModels = {
      }
      const modelsPromise = core40SDK.ok(core40SDK.all_lookml_models(req));
      const promptPromise = promptService.getExplorePrompts();
      const [models, prompts] = await Promise.all([modelsPromise, promptPromise]);  
      setLookerModels(models);
      setTopPrompts(prompts);
      generateComboExploreFromModels(models);  
      generateCombosForTopPrompts(prompts);
      setLoadingLookerModels(false);
      setLoadingLLM(false);
    } catch (error) {
      setLoadingLookerModels(false)
      setErrorMessage('Error loading looks')
    }
  }


  const selectComboExplore = ((selectedValue: string) => {
    const splittedArray = selectedValue.split(".");
    if(splittedArray.length > 0 && splittedArray[0]!=null && splittedArray[1]!=null){
      setCurrentModelName(splittedArray[0]);    
      setCurrentExploreName(splittedArray[1]);              
    } 
    else{
      Logger.error("Error selecting combobox, modelName and exploreName are null or not divided by .");
    }       
    setSelectedModelExplore(selectedValue);
  });

  const selectTopPromptCombo = ((selectedValue: string) => {    
    selectComboExplore(selectedValue);
    topPrompts.forEach(topPrompt => {
      if(topPrompt.modelExplore === selectedValue)
      {
        setPrompt(topPrompt.prompt);        
      }
    });    
  });

  
  const onFilterComboBox = ((filteredTerm: string) => {
    Logger.info("Filtering");
    setCurrentComboExplores(allComboExplores?.filter(explore => explore.label!.toLowerCase().includes(filteredTerm.toLowerCase())));
  });

  const selectCurrentExploreName = (exploreName: string) => {
    setCurrentExploreName(exploreName);
  }

  // Method that clears the explores under the chat
  const handleClear = () => {    
    // Removes the first child    )
    exploreDivElement?.removeChild(exploreDivElement.firstChild!);
  }

  const handleClearBottom = () => {    
    // Removes the first child
    exploreDivElement?.removeChild(exploreDivElement.lastChild!);
  }
  const handleClearAll = () => {    
    // Removes the first child
    if(exploreDivElement!=null && exploreDivElement.children!=null)
    {
      for(var i = 0; i < exploreDivElement.children.length; i++)
      {
        exploreDivElement?.removeChild(exploreDivElement.lastChild!);  
      }
    }
  }


  const handleChange = (e: FormEvent<HTMLTextAreaElement>) => {
    setPrompt(e.currentTarget.value)
  }
  
  function transformArrayToString(array: string[]): string {
    return array.join('\\n');
  }


  const extensionContext = useContext<ExtensionContextData>(ExtensionContext);


  const embedCtrRef = useCallback((el) => {
    setHostUrl(extensionContext?.extensionSDK?.lookerHostData?.hostUrl);    
    // set the explore div element outside
    setExploreDivElement(el);           
  }, [])

  // Method that triggers sending the message to the workflow
  const handleSend = () =>
  {    
    handleClearAll();  
    setLoadingLLM(true);
    Logger.debug("Debug CustomPrompt" +  window.sessionStorage.getItem("customPrompt"));
    const promptService = new PromptTemplateService(JSON.parse(window.sessionStorage.getItem("customPrompt")!));
    const generativeExploreService = new ExploreService(core40SDK, promptService);

    // 1. Generate Prompt based on the current selected Looker Explore (Model + ExploreName)
    Logger.info("1. Get the Metadata from Looker from the selected Explorer");    
    if(currentModelName!=null && currentExploreName!=null)
    {
      core40SDK.lookml_model_explore(currentModelName, currentExploreName, "id, name, description, fields, label").then
      (async exploreResult => {
        Logger.info("2. Received Data from Looker");
        // @ts-ignore
        const fields:ILookmlModelExploreFieldset = exploreResult.value.fields;
        const f_dimensions:ILookmlModelExploreField[]  =  fields.dimensions!;
        const f_measures:ILookmlModelExploreField[]  =  fields.measures!;
        const f_dim_measures = f_dimensions.concat(f_measures);
        var my_fields:Array<FieldMetadata> = [];
        if(f_dim_measures!=null)
        {
          for(var field of f_dim_measures)
          {
            var field_def:FieldMetadata = {
              // "field_type": "Dimension", this is not needed
              // "view_name": dimension.view_label,
              label : field.label!,
              name: field.name!,
              // "type": dimension.type,
              description: field.description!
              // "sql": dimension.sql,
            };
            my_fields.push(field_def);
          }          
        }
        if(!exploreResult.ok)
        {
          throw new Error("Missing value from explore result");
        }
        const viewName = exploreResult.value.name;
        if (!prompt) {
          throw new Error('missing user prompt, unable to create query');
        }                
        Logger.info("3. Generate Prompts and Send to BigQuery");
        const { modelName, queryId, view } = await generativeExploreService.generatePromptSendToBigQuery(my_fields, prompt, currentModelName, viewName!);
        // Update the Explore with New QueryId
        LookerEmbedSDK.init(hostUrl!);
        Logger.debug("explore not null: " + currentExploreId);
        LookerEmbedSDK.createExploreWithUrl(hostUrl+ `/embed/explore/${modelName}/${view}?qid=${queryId}`)
          .appendTo(exploreDivElement!)         
          .build()          
          .connect()                    
          .then()          
          .catch((error: Error) => {
            Logger.error('Connection error', error);
            setLoadingLLM(false);
          });
        setLoadingLLM(false);
      })
    }
    else
    {
      setLoadingLLM(false);
    }    
  }

  
  return (    
    <ComponentsProvider>
      <Space around>
        <Span fontSize="xxxxxlarge">
          {message}
        </Span>        
      </Space>      
      <SpaceVertical>
        <Space around> 
        <Heading fontWeight="semiBold"> Looker GenAI Demo: go/lookerllm - Design: go/lookerllm-design</Heading>
        </Space>
        <Space around> 
        <Span> v:{ConfigReader.CURRENT_VERSION} - updated:{ConfigReader.LAST_UPDATED}</Span>
        </Space>
      </SpaceVertical>      
      <Box display="flex" m="large">        
          <SpaceVertical>
          {showInstructions? 
          <SpaceVertical>
            <Span fontSize="large">
            Quick Start:                                    
            </Span>  
            <Span fontSize="medium">
            1. Select the Explore by selecting or typing.
            </Span>          
            <Span fontSize="medium">
            2. Click on the Text Area and type your question to the Explore - <b>example: What are the top 15 count, language and day. Pivot per day</b>
            </Span>
            <Span fontSize="medium">
            3. Wait for the Explore to appear below and add to an dashboard if needed.
            </Span>                      
          </SpaceVertical> 
            : <Span/>
          }                  
          <Span fontSize="medium">
            Any doubts or feedback or bugs, send it to <b>looker-genai-extension@google.com</b>
          </Span>   
          <FieldSelect 
            id="topExamplesId"           
            label="Top Examples to Try"
            onChange={selectTopPromptCombo}           
            options={topPromptsCombos}
            width={500}
          />

          <FieldSelect                       
            isFilterable
            onFilter={onFilterComboBox}
            isLoading={loadingLookerModels}
            label="All Explores"
            onChange={selectComboExplore}            
            options={currentComboExplores}
            width={500}
            value={selectedModelExplore}
          />    
          <FieldTextArea            
            width="100%"
            label="Type your question"  
            value={prompt}
            onChange={handleChange}
          />
          <Space>
            <Button onClick={handleSend}>Send</Button>                     
          </Space>        
          <Dialog isOpen={loadingLLM}>
            <DialogLayout header="Loading LLM Data to Explore...">
              <Spinner size={80}>
              </Spinner>
            </DialogLayout>            
            </Dialog>        
          
        <EmbedContainer ref={embedCtrRef}>          
        </EmbedContainer>
        </SpaceVertical>                                   
      </Box>

    </ComponentsProvider>
  )
}


