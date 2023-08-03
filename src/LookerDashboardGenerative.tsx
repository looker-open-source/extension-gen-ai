// Copyright 2023 Google LLC

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
  IDashboardBase,
  ILookmlModel,
  ISqlQueryCreate,
  ILookmlModelExploreFieldset,
  ILookmlModelExploreField,
  IRequestRunQuery,
  IDashboardElement
} from '@looker/sdk'
import { Switch, Route, useHistory, useRouteMatch } from 'react-router-dom'
import { MessageBar, Box, Heading } from '@looker/components'
import { ISDKSuccessResponse } from '@looker/sdk-rtl'
import { EmbedContainer } from './EmbedContainer'
import { LookerEmbedExplore , LookerEmbedSDK} from '@looker/embed-sdk'
import { forEach, split } from 'lodash'
import { ignoredYellowBox } from 'console'

/**
 * A simple component that uses the Looker SDK through the extension sdk to display a customized hello message.
 */
export const LookerDashboardGenerative: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const [message, setMessage] = useState('')
  const [loadingCombobox, setLoadingCombobox] = useState<boolean>(false)
  const [loadingLLM, setLoadingLLM] = useState<boolean>(false)
  const [lookerDashboards, setLookerDashboards] = useState<IDashboardBase[]>([])
  const [errorMessage, setErrorMessage] = useState<string>()
  const [allCombo, setAllCombo] = useState<ComboboxOptionObject[]>()
  const [currentCombo, setCurrentCombo] = useState<ComboboxOptionObject[]>()
  const [currentDashName, setCurrentDashName] = useState<string>()
  const [currentDashId, setCurrentDashId] = useState<string>()
  const [prompt, setPrompt] = useState<string>()
  const [llmInsights, setLlmInsights] = useState<string>()
  const [exploreDivElement, setExploreDivElement] = useState<HTMLDivElement>()

  const [currentDashElementCount, setCurrentDashElementCount] = useState<number>()
  const [currentDashData, setCurrentDashData] = useState<{[key: string]: {}}>({})


  
  const [hostUrl, setHostUrl] = useState<string>()

  const defaultWelcomePrompt = "`Act as an experienced Business Data Analyst with PHD and answer the question having into";
  const defaultPromptValue = "Can you summarize the following datasets in 10 bullet points?";

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
    loadDashboards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function generateComboDashboards(listDashs: IDashboardBase[]) {
    var allValues:ComboboxOptionObject[] = [];
    listDashs.forEach(dash => {      
      if( dash!=null)
      {          
        const exp = {
          label: dash.title + " - " + dash.id,
          value: dash.title + "." + dash.id  
        };
        // @ts-ignore
        allValues.push(exp);
      }        
    });  
    // set Initial Combo Explore and All
    setAllCombo(allValues);
    setCurrentCombo(allValues);
    setPrompt(defaultPromptValue);
  }

  const loadDashboards = async () => {
    setLoadingCombobox(true);
    setErrorMessage(undefined);
    try {      
      const result = await core40SDK.ok(core40SDK.all_dashboards())
      setLookerDashboards(result);
      generateComboDashboards(result);      
      setLoadingCombobox(false);
    } catch (error) {
      setLoadingCombobox(false)
      setErrorMessage('Error loading looks')
    }
  }

  const selectCombo = ((selectedValue: string) => {
    const splittedArray = selectedValue.split(".");
    if(splittedArray.length > 0 && splittedArray[0]!=null && splittedArray[1]!=null){
      setCurrentDashName(splittedArray[0]);    
      setCurrentDashId(splittedArray[1]);              
    } 
    else{
      console.log("Error selecting combobox, modelName and exploreName are null or not divided by .");
    }

    // Removes the first child
    if(exploreDivElement!=null && exploreDivElement.children!=null)
    {
      for(var i = 0; i < exploreDivElement.children.length; i++)
      {
        exploreDivElement?.removeChild(exploreDivElement.lastChild!);  
      }
    }

    setHostUrl(extensionContext?.extensionSDK?.lookerHostData?.hostUrl);
    // @ts-ignore            
    LookerEmbedSDK.init(hostUrl!);
    LookerEmbedSDK.createDashboardWithId(splittedArray[1])
    .appendTo(exploreDivElement!)                              
    .build()        
    .connect()
    .then()
    .catch((error: Error) => {
      console.error('Connection error', error)
    });     
  });
  
  const onFilterComboBox = ((filteredTerm: string) => {
    console.log("Filtering");
    setCurrentCombo(allCombo?.filter(explore => explore.label!.toLowerCase().includes(filteredTerm.toLowerCase())));
  });

  const selectCurrentExploreName = (exploreName: string) => {
    setCurrentDashId(exploreName);
  }

  // Method that clears the explores under the chat
  const handleClear = () => {    
    // Removes the first child
    setLlmInsights("");
  }
 

  const handleChange = (e: FormEvent<HTMLTextAreaElement>) => {
    setPrompt(e.currentTarget.value)
  }

  
  const sendPromptToBigQuery = (contextData: {[key: string]: {}}, question: string ) =>
  {
    // Fix some characters that breaks BigQuery Query
    var ctx = JSON.stringify(contextData);    
    ctx = ctx.replace(/\'/g, '\\\'');

    console.log("Sending Prompt to BigQuery LLM");
    const singleLineString = `Act as an experienced Business Data Analyst with PHD and answer the question having into context the following Data: ${ctx} Question: ${question}`;

    // query to run
    const query_to_run = `SELECT ml_generate_text_llm_result as r, ml_generate_text_status
    FROM
      ML.GENERATE_TEXT(
        MODEL llm.llm_model,
        (
          SELECT '`+ singleLineString + `' AS prompt
        ),
        STRUCT(
          0.1 AS temperature,
          1024 AS max_output_tokens,
          0.1 AS top_p,
          TRUE AS flatten_json_output,
          10 AS top_k));
    `;
    // console.log("Query to Run: " + query_to_run);
    const sql_query_create_param: ISqlQueryCreate = {
      connection_name: "@{CONNECTION_NAME}",
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
          core40SDK.run_sql_query(slug, "json").then(
            results =>
            {        
              if(results.ok)
              {
                var first_result = results.value[0];
                // @ts-ignore                                               
                first_result.r!= null?setLlmInsights(first_result.r):setLlmInsights(first_result.ml_generate_text_status);                
              }              
              else{
                setLlmInsights("Error: " + results.error);
              }   
              setLoadingLLM(false);                        
            }
          )          
        }
      }
    )
  }

  // resets combo explore with all models and explores
  const resetComboExplore = (callback: (ComboboxCallback<MaybeComboboxOptionObject>)) => {
    setCurrentCombo(allCombo);
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
    console.log("1. Get the Data From all the Dashboards");        
    if(currentDashName!=null && currentDashId!=null)
    {
      core40SDK.dashboard(currentDashId).then
      (dash =>{
        if(dash.ok)
        {
          var allDashboardElements:IDashboardElement[] = dash.value.dashboard_elements!;
          var currentCount = allDashboardElements.length;
          console.log("Count of Element Dashboards: " + currentCount);
          var currentJsonData:{[key: string]: {}} = {};
          if(currentCount == 0)
          {
            setLoadingLLM(false);
            setLlmInsights("Dashboard Loaded Empty");
          }          

          for(var dashboardElement of dash.value.dashboard_elements!)
          {
            var queryId = dashboardElement.query_id;
            if(queryId == null)
            {
              // Different Dashboard Versions
              queryId = dashboardElement.result_maker?.query_id;
            }
            if(queryId!= null)
            {
              // @ts-ignore          
              console.log("QueryId:" + queryId);
              var req: IRequestRunQuery = {
                query_id: queryId,
                result_format: "json"
              } 
              console.log("Request: "+ req);
              core40SDK.run_query(req).then(
                result => {
                  if(result.ok)
                  {                
                    currentJsonData[currentCount] = result.value.slice(0,50);                                  
                  }
                  else
                  {
                    console.log("Error Getting Data from Dashboard Element " + queryId);
                  }   
                  if(currentCount > 0)
                  {
                    currentCount-=1;
                  }
                  if(currentCount == 0)
                  {
                    console.log("finished loading elements");                
                    sendPromptToBigQuery(currentJsonData, prompt!);
                  }                                                      
                }
              );   
            }
            else
            {
              console.log("Could not find queryId for dashboardElement");                
              currentCount-=1;
            }
          }
        }
      });
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
        <Heading fontWeight="semiBold">Looker AI Insights on Dashboards</Heading>                        
      </Space>      
      <Box display="flex" m="large">        
          <SpaceVertical>
          <Span fontSize="x-large">
          Quick Start:                                    
          </Span>  
          <Span fontSize="medium">
          1. Select the Dashboard by selecting or typing - <b>example: eCommerce Logistics Demo - 26</b>
          </Span>
          <Span fontSize="medium">
          2. Input a question that you want to ask the dashboard - <b>example: How is the status of the business? Give me some insights!</b>
          </Span>          
          <Span fontSize="medium">
          Any doubts or feedback or bugs, send it to <b>gricardo@google.com</b>
          </Span>

          <FieldSelect
            onOpen={resetComboExplore}                        
            isFilterable
            onFilter={onFilterComboBox}
            isLoading={loadingCombobox}
            label="All Dashboards"
            onChange={selectCombo}            
            options={currentCombo}
            width={500}
          />
          <Space>
            <Button onClick={handleSend}>Send</Button>
            <Button onClick={handleClear}>Clear Insights</Button>            
          </Space>
          <FieldTextArea            
            width="100%"
            label="Type your question"  
            value={prompt}
            onChange={handleChange}
            defaultValue={defaultPromptValue}
          />  
          <Dialog isOpen={loadingLLM}>
            <DialogLayout header="Loading LLM Data to Explore...">
              <Spinner size={80}>
              </Spinner>
            </DialogLayout>            
            </Dialog>  

          <FieldTextArea            
            width="100%"
            label="LLM Insights"  
            value={llmInsights}
          /> 
          <EmbedContainer ref={embedCtrRef}>          
          </EmbedContainer>                   
        </SpaceVertical>                                   
      </Box>

    </ComponentsProvider>
  )
}
