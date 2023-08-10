// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useContext, useEffect, useState , FormEvent, useCallback, ReactElement} from 'react'
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
  CodeBlock
  } from '@looker/components'
import { Dialog, DialogLayout, ButtonTransparent  } from '@looker/components'
import { ExtensionContext , ExtensionContextData} from '@looker/extension-sdk-react'
import { 
  type ILook,
  IRequestAllLookmlModels,
  ILookmlModel,
  ISqlQueryCreate,
  ILookmlModelExploreFieldset,
  ILookmlModelExploreField
} from '@looker/sdk'
import { Switch, Route, useHistory, useRouteMatch } from 'react-router-dom'
import { MessageBar, Box, Heading } from '@looker/components'
import { ISDKSuccessResponse } from '@looker/sdk-rtl'
import { EmbedContainer } from './EmbedContainer'
import { LookerEmbedExplore , LookerEmbedSDK} from '@looker/embed-sdk'
import { forEach, split } from 'lodash'

/**
 * A simple component that uses the Looker SDK through the extension sdk to display a customized hello message.
 */
export const LookerExploreGenerative: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
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
    const getMe = async () => {
      try {
        const me = await core40SDK.ok(core40SDK.me())
        setMessage(`Hello, ${me.display_name}`)
      } catch (error) {
        console.error(error)
        setMessage('An error occurred while getting information about me!')
      }
    }
    getMe()
  }, [])

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

  const generatePrompt = (jsonPayloadLookMLExplore: string, modelName: string, viewName: string) => {
  
    const generatedPrompt = `
    Write a simple JSON body for Looker LLM application.
    Make sure to use the following 3 rules:
    1. The JSON has a structure of model (string), view(string), fields(array of strings), filters(array of strings), sorts(array of strings), pivots(array of strings), limit(int).
    2. All the fields, sorts, pivots need to be in the dictionary provided for the input.    
    3. Use syntax compatible with Looker matching filters with data types.

    Here are some generic examples that uses a example_input_dictionary with model: "bi_engine_demo" and view: "wiki100_m", so you can learn how does it works:
    example_input_dictionary : [{"label":"Wiki100 M Day","field":"wiki100_m.day","description":""},{"label":"Wiki100 M Language","field":"wiki100_m.language","description":""},{"label":"Wiki100 M Month","field":"wiki100_m.month","description":""},{"label":"Wiki100 M Title","field":"wiki100_m.title","description":""},{"label":"Wiki100 M Views","field":"wiki100_m.views","description":""},{"label":"Wiki100 M Wikimedia Project","field":"wiki100_m.wikimedia_project","description":""},{"label":"Wiki100 M Year","field":"wiki100_m.year","description":""},{"label":"Wiki100 M Count","field":"wiki100_m.count","description":""}]
    
    input: What are the top 10 languages?
    output: {"model": "bi_engine_demo", "view": "wiki100_m", "fields": ["wiki100_m.count", "wiki100_m.language"], "filters": null, "sorts": ["wiki100_m.count desc"], "pivots": null, "limit": "10"}

    input: count per language in year 2023
    output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language","wiki100_m.year"],"filters": { "wiki100_m.year": "2023"}, "sorts": [],"pivots": null,"limit": "500"}

    input: count per language pivot per year order by year desc
    output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language","wiki100_m.year"],"filters": null, "sorts": ["wiki100_m.year desc],"pivots": ["wiki100_m.year"],"limit": "500"}

    input:  What is the count per language, year, considering the folowing languages: en,pt,es?
    output: { "model": "bi_engine_demo", "view": "wiki100_m", "fields": [ "wiki100_m.count","wiki100_m.language", "wiki100_m.year"],"filters": {"wiki100_m.language": "en,fr,es"}, "sorts": null,"pivots": ["wiki100_m.year"],"limit": "500"}

    Now, generate the output with model: ${modelName} and view: "${viewName}".
    Make sure to use data from the input_dictionary to select filters, sorts and pivots.   
    Input: ${prompt}
    Input_dictionary : ${jsonPayloadLookMLExplore}  
  `
  return generatedPrompt;
  
  }
 
  function transformArrayToString(array: string[]): string {
    return array.join('\\n');
  }

  
  const sendPromptToBigQuery = (promptToSend: string, modelName: string, viewName: string) =>
  {
    const arraySplitted = promptToSend.split('\n');
    const singleLineString = transformArrayToString(arraySplitted);

    console.log("Sending Prompt to BigQuery LLM");
    // query to run
    const query_to_run = `SELECT llm.bq_vertex_remote('`+ singleLineString + `') AS llm_result`;
    console.log("Query to Run: " + query_to_run);
    
    const sql_query_create_param: ISqlQueryCreate = {
      connection_name:"dataml-latam-argolis",
      sql: query_to_run         
    }

    // Create SQL Query to Run
    core40SDK.create_sql_query(sql_query_create_param).then(
      results => {
        // @ts-ignore
        const slug =  results.value.slug;
        console.log("Create BQML Query with slug: "  + slug);
        if(slug != null)
        {
          // Run SQL Query with Prompt
          core40SDK.run_sql_query(slug, "txt").then(
            results =>
            {        
              // @ts-ignore
              const results_string = results.value;
              var json_dict;
              try {
                var cleanString = results_string.replace('r', '');                            
                cleanString = cleanString.replace(/\"\"/g, '\"');
                cleanString = cleanString.slice(cleanString.indexOf('"')+1, cleanString.lastIndexOf('"'));
                json_dict = JSON.parse(cleanString);
              }
              catch(error){
                json_dict = {
                    "model": modelName,
                    "view": viewName,
                    "fields": [],
                    "filters": null,
                    "sorts": null,
                }
              }                            
                    
              
              console.log(json_dict);
              // Create a Query
              core40SDK.create_query(json_dict).then(
                results =>
                {
                  // If want to clean old results
                  // if(true){
                  //   handleClear();
                  // } 
                  setHostUrl(extensionContext?.extensionSDK?.lookerHostData?.hostUrl);
                  // @ts-ignore
                  const view = results.value.view;
                  // @ts-ignore
                  const query_id = results.value.client_id;
                  console.log("Query Id:" + query_id);     
                  // @ts-ignore
                  const modelName = results.value.model;             
                  // // Update the Explore with New QueryId                  
                  LookerEmbedSDK.init(hostUrl!);
                  // if(currentExploreId!= null){
                  console.log("explore not null: " + currentExploreId);
                  LookerEmbedSDK.createExploreWithUrl(hostUrl+ "/embed/explore/"+ modelName + "/"  + view + "?qid=" + query_id)  
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
                }
              );              
            }
          )          
        }
      }
    )
  }





  // resets combo explore with all models and explores
  const resetComboExplore = (callback: (ComboboxCallback<MaybeComboboxOptionObject>)) => {
    setCurrentComboExplores(allComboExplores);
  }

  // const setupExplore = (explore: LookerEmbedExplore) => {
  //   console.log("Finished Setup Explore Step");
  //   setLoadingLLM(false);
  // }

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
      (exploreResult => {
        console.log("2. Received Data from Looker");
        // @ts-ignore
        const fields:ILookmlModelExploreFieldset = exploreResult.value.fields;
        const f_dimensions:ILookmlModelExploreField[]  =  fields.dimensions!;
        const f_measures:ILookmlModelExploreField[]  =  fields.measures!;
        const f_dim_measures = f_dimensions.concat(f_measures);
        var my_fields = [];
        if(f_dim_measures!=null)
        {
          for(var field of f_dim_measures)
          {
            var field_def = {
              // "field_type": "Dimension", this is not needed
              // "view_name": dimension.view_label,
              "label" : field.label,  
              "field": field.name,
              // "type": dimension.type,
              "description": field.description,
              // "sql": dimension.sql,
            };
            my_fields.push(field_def);
          }          
        }
        const jsonPayloadLookMLExplore = JSON.stringify(my_fields);
        // @ts-ignore
        const viewName = exploreResult.value.name!;
        console.log("3. Will Generate Prompt");
        const generatedPrompt = generatePrompt(jsonPayloadLookMLExplore, currentModelName, viewName);

        console.log("4. Send to BigQuery");
        sendPromptToBigQuery(generatedPrompt, currentModelName, viewName);              
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
