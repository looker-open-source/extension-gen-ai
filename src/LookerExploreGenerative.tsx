// Copyright 2023 Google LLC

import React, { useContext, useEffect, useState , FormEvent, useCallback } from 'react'
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
} from '@looker/components'
import { Dialog, DialogLayout } from '@looker/components'
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
import { LookerEmbedSDK} from '@looker/embed-sdk'
import { GenerativeExploreService, FieldMetadata } from './services/GenerativeExploreService'

/**
 * A simple component that uses the Looker SDK through the extension sdk to display a customized hello message.
 */
export const LookerExploreGenerative: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const generativeExploreService = new GenerativeExploreService(core40SDK);
  const [message, setMessage] = useState('')
  const [loadingLookerModels, setLoadingLookerModels] = useState<boolean>(false)
  const [loadingLLM, setLoadingLLM] = useState<boolean>(false)
  const [lookerModels, setLookerModels] = useState<ILookmlModel[]>([])
  const [errorMessage, setErrorMessage] = useState<string>()
  const [allComboExplores, setAllComboExplores] = useState<ComboboxOptionObject[]>()
  const [currentComboExplores, setCurrentComboExplores] = useState<ComboboxOptionObject[]>()
  const [currentModelName, setCurrentModelName] = useState<string>()
  const [currentExploreName, setCurrentExploreName] = useState<string>()
  const [prompt, setPrompt] = useState<string>()
  const [currentExploreId, setCurrentExploreId] = useState<string>()
  const [exploreDivElement, setExploreDivElement] = useState<HTMLDivElement>()
  const [hostUrl, setHostUrl] = useState<string>()

  useEffect(() => {
    loadExplores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function generateComboExploreFromModels(listModels: ILookmlModel[]) {
    var allValues:ComboboxOptionObject[] = [];
    listModels.forEach(model => {
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

  const loadExplores = async () => {
    setLoadingLookerModels(true);
    setErrorMessage(undefined);
    try {
      const req: IRequestAllLookmlModels = {
      }
      const result = await core40SDK.ok(core40SDK.all_lookml_models(req))
      setLookerModels(result.slice(0,1000));
      generateComboExploreFromModels(result);      
      setLoadingLookerModels(false);
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
      console.log("Error selecting combobox, modelName and exploreName are null or not divided by .");
    }   
  });
  
  const onFilterComboBox = ((filteredTerm: string) => {
    console.log("Filtering");
    setCurrentComboExplores(allComboExplores?.filter(explore => explore.label!.toLowerCase().includes(filteredTerm.toLowerCase())));
  });

  const selectCurrentExploreName = (exploreName: string) => {
    setCurrentExploreName(exploreName);
  }

  // Method that clears the explores under the chat
  const handleClear = () => {    
    // Removes the first child
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


  // resets combo explore with all models and explores
  const resetComboExplore = (callback: (ComboboxCallback<MaybeComboboxOptionObject>)) => {
    setCurrentComboExplores(allComboExplores);
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
    setLoadingLLM(true);
    // 1. Generate Prompt based on the current selected Looker Explore (Model + ExploreName)
    console.log("1. Get the Metadata from Looker from the selected Explorer");    
    if(currentModelName!=null && currentExploreName!=null)
    {
      core40SDK.lookml_model_explore(currentModelName, currentExploreName, "id, name, description, fields, label").then
      (async exploreResult => {
        console.log("2. Received Data from Looker");
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
        // @ts-ignore
        const viewName = exploreResult.value.name!;
        if (!prompt) {
          throw new Error('missing user prompt, unable to create query');
        }                
        console.log("3. Generate Prompts and Send to BigQuery");
        const { modelName, queryId, view } = await generativeExploreService.generatePromptSendToBigQuery(my_fields, prompt, currentModelName, viewName);
        // Update the Explore with New QueryId
        LookerEmbedSDK.init(hostUrl!);
        console.log("explore not null: " + currentExploreId);
        LookerEmbedSDK.createExploreWithUrl(hostUrl+ `/embed/explore/${modelName}/${view}?qid=${queryId}`)
          .appendTo(exploreDivElement!)
          .build()
          .connect()
          .then()
          .catch((error: Error) => {
            console.error('Connection error', error)
            setLoadingLLM(false);
          });
        // TODO: Ideally find the event after the Explore is added to the Div to Remove the Loading LLM dialog
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
      <Space around>
        <Heading fontWeight="semiBold">Looker AI Demo: go/lookerai-llm-demo - Design: go/lookerai-llm</Heading>                        
      </Space>      
      <Box display="flex" m="large">        
          <SpaceVertical>
          <Span fontSize="x-large">
          Quick Start:                                    
          </Span>  
          <Span fontSize="medium">
          1. Select the Explore by selecting or typing - <b>example: wiki</b>
          </Span>
          <Span fontSize="medium">
          2. Click on the Text Area and type your question to the Explore - <b>example: What are the top 10 languages?</b>
          </Span>
          <Span fontSize="medium">
          3. Wait for the Explore to appear below and add to an dashboard if needed
          </Span>
          <Span fontSize="medium">
          4. Every question will append the explore below, if you want to clear it use the Remove From Top or Bottom
          </Span>
          <Span fontSize="medium">
          Any doubts or feedback or bugs, send it to <b>gricardo@google.com</b>
          </Span>

          <FieldSelect
            onOpen={resetComboExplore}                        
            isFilterable
            onFilter={onFilterComboBox}
            isLoading={loadingLookerModels}
            label="All Explores"
            onChange={selectComboExplore}            
            options={currentComboExplores}
            width={500}
          />
          <Space>
            <Button onClick={handleSend}>Send</Button>
            <Button onClick={handleClear}>Remove from Top Explore</Button>            
            <Button onClick={handleClearBottom}>Remove from Bottom Explore</Button>            
          </Space>
          <FieldTextArea            
            width="100%"
            label="Type your question"  
            value={prompt}
            onChange={handleChange}
          />  
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
