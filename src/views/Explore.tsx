/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
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
  MaybeComboboxOptionObject,
  TextArea
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
import { PromptTemplateService, PromptTemplateTypeEnum } from '../services/PromptTemplateService'
import { Logger } from '../utils/Logger'
import { ConfigReader } from '../services/ConfigReader'
import { PromptService } from '../services/PromptService'
import PromptModel from '../models/PromptModel'
import { StateContext } from '../context/settingsContext'
import { StateContextType } from '../@types/settings'
/**
 * Looker GenAI - Explore Component
 */
export const Explore: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const [message, setMessage] = useState('')
  const [loadingLookerModels, setLoadingLookerModels] = useState<boolean>(false)
  const [loadingLLM, setLoadingLLM] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>()  
  const [currentModelName, setCurrentModelName] = useState<string>()
  const [currentExploreName, setCurrentExploreName] = useState<string>()  
  const [currentExploreId, setCurrentExploreId] = useState<string>()
  const [exploreDivElement, setExploreDivElement] = useState<HTMLDivElement>()
  const [hostUrl, setHostUrl] = useState<string>()
  const [llmInsights, setLlmInsights] = useState<string>()
  
  const [topPromptsCombos, setTopPromptsCombos] = useState<ComboboxOptionObject[]>()  
  const { configSettings, exploreComboPromptExamples, explorePromptExamples, exploreComboModels,
    exploreCurrentComboModels,selectedModelExplore ,setExploreCurrentComboModels,
    setSelectedModelExplore, prompt, setPrompt, llmModelSize,
    checkUseNativeBQ } = React.useContext(StateContext) as StateContextType;


  const promptService: PromptService = new PromptService(core40SDK);


  useEffect(() => {
    loadExplores();  
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadExplores = async () => { 
    Logger.debug("Loading Explores");
    setExploreCurrentComboModels(exploreComboModels);
    if(selectedModelExplore)
    {
      selectComboExplore(selectedModelExplore);
    }
    setErrorMessage(undefined);    
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
    const comboExploreArray = selectedValue.split("@@@");    
    selectComboExplore(comboExploreArray[0]);
    explorePromptExamples.forEach(topPrompt => {
      if(topPrompt.prompt === comboExploreArray[1])
      {
        setPrompt(topPrompt.prompt);        
      }
    });    
  });

  
  const onFilterComboBox = ((filteredTerm: string) => {
    
    Logger.info("Filtering");
    setExploreCurrentComboModels(exploreComboModels?.filter(explore => explore.label!.toLowerCase().includes(filteredTerm.toLowerCase())));
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
    setLlmInsights("");
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
  const handleSend = async () =>
  { 
    const startTime = performance.now();
    handleClearAll();  
    setLoadingLLM(true);
    var promptService = new PromptTemplateService();
    try {      
      
      const customPrompt = configSettings.customPrompt!;
      const customTemplate =  {
        [PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: customPrompt
      };
      promptService = new PromptTemplateService(customTemplate);
    }
    catch{
      Logger.error("Failed to load custom prompt from Session Storage");
    }
        
    const generativeExploreService = new ExploreService(core40SDK, promptService, llmModelSize, checkUseNativeBQ);

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
            // Hidden is not true
            if(field.hidden != true)
            {
              var field_def:FieldMetadata = {
                // "field_type": "Dimension", this is not needed
                // "view_name": dimension.view_label,
                label : field.label!,
                name: field.name!,
                type: field.type!,
                description: field.description!
                // "sql": dimension.sql,
              };
              my_fields.push(field_def);
            }            
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
        const { clientId,  queryId, modelName, view } = await generativeExploreService.generatePromptSendToBigQuery(my_fields, prompt, currentModelName, viewName!, llmModelSize);
        // Update the Explore with New QueryId
        LookerEmbedSDK.init(hostUrl!);
        Logger.debug("explore not null: " + currentExploreId);
        LookerEmbedSDK.createExploreWithUrl(hostUrl+ `/embed/explore/${modelName}/${view}?qid=${clientId}`)
          .appendTo(exploreDivElement!)         
          .build()          
          .connect()                    
          .then()          
          .catch((error: Error) => {
            Logger.error('Connection error', error);
            setLoadingLLM(false);
          });
        setLoadingLLM(false);

        // Do something that takes time
        const endTime = performance.now();
        const elapsedTime = (endTime - startTime)/1000;
        Logger.info(`Elapsed to render explore: ${elapsedTime} s`);
        // After loading is complete,
        // Try to see if I can answer the question in text format the same way as dashboard and getting data from the queryId
        Logger.debug("Async try to set the LLM Insight after explore is on");        
        try
        {
          const insight = await generativeExploreService.answerQuestionWithData(prompt, queryId);
          setLlmInsights(insight);
        }
        catch(error)
        {
          Logger.error("Failed to get LLM Insight Output ", error);
        }        
      })
    }
    else
    {
      setLoadingLLM(false);
    }    
  }

  
  return (      
    <ComponentsProvider>            
      <Space align="start">        
        <SpaceVertical align="start" width="350px" paddingLeft="15px">                                      
            <FieldSelect 
              id="topExamplesId"           
              label="Top Examples to Try"
              onChange={selectTopPromptCombo}           
              options={exploreComboPromptExamples}
              width="100%"
            />
            <FieldSelect                       
              isFilterable
              onFilter={onFilterComboBox}
              label="All Explores"
              onChange={selectComboExplore}            
              options={exploreCurrentComboModels}
              width="100%"
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
            <SpaceVertical stretch>
              <TextArea                        
                placeholder="[Experimental] LLM Text Answer"
                value={llmInsights}
                readOnly
                height="200px"
              />
              </SpaceVertical>         
            <Dialog isOpen={loadingLLM}>
              <DialogLayout header="Loading LLM Data to Explore...">
                <Spinner size={80}>
                </Spinner>
              </DialogLayout>            
            </Dialog>
        </SpaceVertical>                                                                 
        <Space stretch>
          <EmbedContainer ref={embedCtrRef}>          
          </EmbedContainer>
        </Space>
      </Space>
    </ComponentsProvider>
  )
}


