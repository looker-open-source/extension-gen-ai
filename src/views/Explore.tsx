/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import React, { useContext, useEffect, useState , FormEvent, useCallback} from 'react'
import * as Icons from '@styled-icons/material';
import { 
  Button, 
  ComponentsProvider,
  FieldTextArea,
  Space,
  SpaceVertical,
  Spinner,
  FieldSelect, 
  TextArea,
  IconButton
} from '@looker/components'
import { Dialog, DialogLayout} from '@looker/components'
import { ExtensionContext , ExtensionContextData } from '@looker/extension-sdk-react'
import {   
  ILookmlModelExploreFieldset,
  ILookmlModelExploreField
} from '@looker/sdk'
import { EmbedContainer } from './EmbedContainer'
import { ExploreEvent, LookerEmbedLook, LookerEmbedSDK} from '@looker/embed-sdk'
import { ExploreService, FieldMetadata } from '../services/ExploreService'
import { PromptTemplateService, PromptTemplateTypeEnum } from '../services/PromptTemplateService'
import { Logger } from '../utils/Logger'
import { PromptService } from '../services/PromptService'
import { StateContext } from '../context/settingsContext'
import { StateContextType } from '../@types/settings'
import LookerExploreDataModel from '../models/LookerExploreData';
/**
 * Looker GenAI - Explore Component
 */
export const Explore: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const [message, setMessage] = useState('')
  const [loadingLLM, setLoadingLLM] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>()  
  const [currentModelName, setCurrentModelName] = useState<string>()
  const [currentExploreName, setCurrentExploreName] = useState<string>()  
  const [currentExploreId, setCurrentExploreId] = useState<string>()
  const [exploreDivElement, setExploreDivElement] = useState<HTMLDivElement>()
  const [hostUrl, setHostUrl] = useState<string>()
  const [llmInsights, setLlmInsights] = useState<string>()
  const { configSettings, exploreComboPromptExamples, explorePromptExamples, exploreComboModels,
    exploreCurrentComboModels,selectedModelExplore ,setExploreCurrentComboModels,
    setSelectedModelExplore, prompt, setPrompt, llmModelSize,
    checkUseNativeBQ } = React.useContext(StateContext) as StateContextType;

  const [currentFields, setCurrentFields] = useState<FieldMetadata[]>();
  const [currentExploreData, setCurrentExploreData] = useState<LookerExploreDataModel>();
  const [generativeExploreService, setGenerativeExploreService] = useState<ExploreService>();


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
    setGenerativeExploreService(new ExploreService(core40SDK, promptService, llmModelSize, checkUseNativeBQ));

    // window.addEventListener("message", function(event) {
    //     console.log("Message received");
    //     if(event.type =="message")
    //     {
    //       console.log(JSON.parse(event.data));    
    //     }        
    //     console.log(event);            
    //   }
    // );

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

  function handleThumbs(upDown: boolean) {
    if(generativeExploreService == null)
    {
      Logger.error("GenerativeExploreService is null");
    }
    if(currentExploreData == null)
    {
      Logger.error("currentExploreData is null");
    }
    if(currentFields == null)
    {
      Logger.error("currentFields is null");
    }    
    generativeExploreService!.logLookerFilterFields(currentFields!, prompt, currentExploreData!, upDown?1:0);    
  }

  // Method that triggers sending the message to the workflow
  const handleThumbsUp = async () =>
  {     
    handleThumbs(true);
  }

  // Method that triggers sending the message to the workflow
  const handleThumbsDown = async () =>
  { 
    handleThumbs(false);
  }

  // Method that triggers sending the message to the workflow
  const handleSend = async () =>
  { 
    const startTime = performance.now();
    handleClearAll();  
    setLoadingLLM(true);
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
        setCurrentFields(my_fields);
        // 3. Generate Prompts and Send to BigQuery
        if(!exploreResult.ok)
        {
          throw new Error("Missing value from explore result");
        }
        const viewName = exploreResult.value.name;
        if (!prompt) {
          throw new Error('missing user prompt, unable to create query');
        }                
        Logger.info("3. Generate Prompts and Send to BigQuery");
        try
        {
          const { clientId,  queryId, modelName, view, exploreData} = await generativeExploreService!.generatePromptSendToBigQuery(my_fields, prompt, currentModelName, viewName!, llmModelSize);
          // Update the Explore with New QueryId      
          LookerEmbedSDK.init(hostUrl!);
          Logger.debug("explore not null: " + currentExploreId + "hostUrl: " + hostUrl!);
          // const embedExplore = LookerEmbedSDK.createExploreWithUrl(hostUrl+ `/embed/explore/${modelName}/${view}?embed_domain=https://localhost:8080&qid=${clientId}`)
          
          const embedExplore = LookerEmbedSDK.createExploreWithUrl(hostUrl+ `/embed/explore/${modelName}/${view}?qid=${clientId}`)
            .appendTo(exploreDivElement!)                             
            .build()          
            .connect()                    
            .then()                    
            .catch((error: Error) => {
              Logger.error('Connection error', error);
              setLoadingLLM(false);
            });
  
          setCurrentExploreData(exploreData);
          setLoadingLLM(false);
          // Log Default Result 
          generativeExploreService!.logLookerFilterFields(my_fields!, prompt, exploreData!, 0);              
          
          // Do something that takes time
          const endTime = performance.now();
          const elapsedTime = (endTime - startTime)/1000;
          Logger.info(`Elapsed to render explore: ${elapsedTime} s`);
          // After loading is complete,
          // Try to see if I can answer the question in text format the same way as dashboard and getting data from the queryId
          Logger.debug("Async try to set the LLM Insight after explore is on");        
          try
          {
            const insight = await generativeExploreService!.answerQuestionWithData(prompt, queryId);
            setLlmInsights(insight);
          }
          catch(error)
          {
            Logger.error("Failed to get LLM Insight Output ", error);
          }        
        }
        catch(error)
        {
          Logger.error("Failed to generate Prompts and Send to BigQuery", error);
          setLoadingLLM(false);
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
              <IconButton icon={<Icons.ThumbUp/>}  label="Up" onClick={handleThumbsUp}/>
              <IconButton icon={<Icons.ThumbDown/>}  label="Down" onClick={handleThumbsDown}/>                             
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


