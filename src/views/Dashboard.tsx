/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import { Box, Button, ComboboxCallback, ComboboxOptionObject, ComponentsProvider, Dialog,
   DialogLayout, FieldSelect, FieldTextArea, TextArea, Heading, MaybeComboboxOptionObject,
    Space, SpaceVertical, Span, Spinner } from '@looker/components'
import { LookerEmbedSDK, LookerEmbedDashboard, DashboardEvent} from '@looker/embed-sdk'
import { ExtensionContext, ExtensionContextData } from '@looker/extension-sdk-react'
import {
  IDashboardBase,
  ISqlQueryCreate
} from '@looker/sdk'
import React, { FormEvent, useCallback, useContext, useEffect, useState } from 'react'
import { EmbedContainer } from './EmbedContainer'
import { DashboardService } from '../services/DashboardService'
import { Logger } from '../utils/Logger'
import { ConfigReader } from '../services/ConfigReader'
import { StateContext } from '../context/settingsContext'
import { StateContextType } from '../@types/settings'

/**
 * Ask a Question to a Dashboard using LLM Models
 * Dashboard Component
 */
export const Dashboard: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const generativeDashboardService = new DashboardService(core40SDK);
  const [message, setMessage] = useState('')
  const [loadingCombobox, setLoadingCombobox] = useState<boolean>(false)
  const [loadingLLM, setLoadingLLM] = useState<boolean>(false)
  const [lookerDashboards, setLookerDashboards] = useState<IDashboardBase[]>([])
  const [allCombo, setAllCombo] = useState<ComboboxOptionObject[]>()
  const [currentCombo, setCurrentCombo] = useState<ComboboxOptionObject[]>()
  const [currentDashName, setCurrentDashName] = useState<string>()
  const [currentDashId, setCurrentDashId] = useState<string>()
  const [currentDashboard, setCurrentDashboard] = useState<LookerEmbedDashboard>();
  const [prompt, setPrompt] = useState<string>()
  const [llmInsights, setLlmInsights] = useState<string>()
  const [dashboardDivElement, setDashboardDivElement] = useState<HTMLDivElement>()
  const [hostUrl, setHostUrl] = useState<string>()

  const defaultWelcomePrompt = "`Act as an experienced Business Data Analyst with PHD and answer the question having into";
  const defaultPromptValue = "Can you summarize the following datasets in 10 bullet points?";

  const { dashboardCombo, checkUseNativeBQ , setShowError, setErrorMessage } = React.useContext(StateContext) as StateContextType;

  useEffect(() => {
    loadDashboards();    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadDashboards() {
    Logger.info("Loading Dashboards"); 
    setAllCombo(dashboardCombo);
    setCurrentCombo(dashboardCombo);
    setPrompt(defaultPromptValue);
  }


  const selectCombo = ((selectedValue: string) => {
    const splittedArray = selectedValue.split(".");
    if(splittedArray.length > 0 && splittedArray[0]!=null && splittedArray[1]!=null){
      setCurrentDashName(splittedArray[0]);
      setCurrentDashId(splittedArray[1]);
    }
    else{
      Logger.error("Error selecting combobox, modelName and exploreName are null or not divided by .");
    }

    // Removes the first child
    if(dashboardDivElement!=null && dashboardDivElement.children!=null)
    {
      for(var i = 0; i < dashboardDivElement.children.length; i++)
      {
        dashboardDivElement?.removeChild(dashboardDivElement.lastChild!);
      }
    }

    setHostUrl(extensionContext?.extensionSDK?.lookerHostData?.hostUrl);
    // @ts-ignore
    LookerEmbedSDK.init(hostUrl!);
    LookerEmbedSDK.createDashboardWithId(splittedArray[1])
    .appendTo(dashboardDivElement!)
    .on('dashboard:run:complete',(event:DashboardEvent) => {
      // TODO: support content reflected by filters
      if(event.dashboard.dashboard_filters!=null)
      {
        Logger.debug("dashboard:filters:changed");
        // Logger.debug(event);
        // Logger.debug(JSON.stringify(event, null, 2));
      }      
    })
    .on('dashboard:filters:changed',(event:DashboardEvent) =>
    {
      Logger.debug("Filters changed");
    })
    .build()
    .connect()
    .then((dash)=> {
      setCurrentDashboard(dash);
    })    
    .catch((error: Error) => {     
      const errorMessage: string = error?.message || "unknown error message";
      setErrorMessage(errorMessage);
      setShowError(true); 
      console.error('Connection error', error)

    });

  });

  const onFilterComboBox = ((filteredTerm: string) => {
    Logger.debug("Filtering");
    setCurrentCombo(allCombo?.filter(dash => dash.label!.toLowerCase().includes(filteredTerm.toLowerCase())));
  });

  const selectCurrentDashId = (dashId: string) => {
    setCurrentDashId(dashId);
  }

  // Method that clears the explores under the chat
  const handleClear = () => {
    // Removes the first child
    setLlmInsights("");
  }


  const handleChange = (e: FormEvent<HTMLTextAreaElement>) => {
    setPrompt(e.currentTarget.value)
  }


  const extensionContext = useContext<ExtensionContextData>(ExtensionContext);

  const embedCtrRef = useCallback((el) => {
    setHostUrl(extensionContext?.extensionSDK?.lookerHostData?.hostUrl);
    // set the Dashboard div element outside
    setDashboardDivElement(el);
  }, [])

  // Method that triggers sending the message to the workflow
  const handleSend = async () =>
  {
    // 1. Generate Prompt based on the current selected Looker Explore (Model + ExploreName)
    Logger.info("1. Get the Data From all the Dashboards");
    if(!currentDashName || !currentDashId)
    {
      console.error('unable to find current dashboard id');
      return;
    }
    if(!prompt)
    {
      console.error('missing prompt');
      return;
    }
    setLoadingLLM(true);
    try {
      const dashboardElementsData = await generativeDashboardService.getDashboardDataById(currentDashId);
      const promptResult = await generativeDashboardService.sendPrompt(dashboardElementsData, prompt, checkUseNativeBQ)
      // update interface with results
      setLlmInsights(promptResult)
    } catch (error) {
      if(error instanceof Error)
      {
        setLlmInsights(`Unexpected error: ${error.message}`);
      }
      else
      {
        setLlmInsights(`Unexpected error:` + error);
      }      
    } finally {
      setLoadingLLM(false);
    }
  }

  return (
    <ComponentsProvider>     
      <Space align="start">        
        <SpaceVertical align="start" width="350px" paddingLeft="15px">                                       
            <FieldSelect
              isFilterable
              onFilter={onFilterComboBox}
              isLoading={loadingCombobox}
              label="All Dashboards"
              onChange={selectCombo}
              options={currentCombo}
              width="100%"
            />
            <FieldTextArea
              width="100%"
              label="Type your question"
              value={prompt}
              onChange={handleChange}
              defaultValue={defaultPromptValue}
            />
            <Space>
              <Button onClick={handleSend}>Send</Button>
              <Button onClick={handleClear}>Clear Insights</Button>
            </Space>
            <Dialog isOpen={loadingLLM}>
              <DialogLayout header="Loading LLM Dashboards...">
                <Spinner size={80}>
                </Spinner>
              </DialogLayout>
            </Dialog>            
             <SpaceVertical stretch>
              <TextArea                        
                placeholder="Insights from LLM Model"
                value={llmInsights}
                readOnly
              />
              </SpaceVertical>                      
           </SpaceVertical>                                                                 
        <Space stretch>
          <EmbedContainer ref={embedCtrRef}>          
          </EmbedContainer>
        </Space>
      </Space>
    </ComponentsProvider>
  )
}
