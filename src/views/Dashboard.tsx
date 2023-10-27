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
  const [errorMessage, setErrorMessage] = useState<string>()
  const [allCombo, setAllCombo] = useState<ComboboxOptionObject[]>()
  const [currentCombo, setCurrentCombo] = useState<ComboboxOptionObject[]>()
  const [currentDashName, setCurrentDashName] = useState<string>()
  const [currentDashId, setCurrentDashId] = useState<string>()
  const [currentDashboard, setCurrentDashboard] = useState<LookerEmbedDashboard>();
  const [prompt, setPrompt] = useState<string>()
  const [llmInsights, setLlmInsights] = useState<string>()
  const [dashboardDivElement, setDashboardDivElement] = useState<HTMLDivElement>()
  const [hostUrl, setHostUrl] = useState<string>()
  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  const defaultWelcomePrompt = "`Act as an experienced Business Data Analyst with PHD and answer the question having into";
  const defaultPromptValue = "Can you summarize the following datasets in 10 bullet points?";

  useEffect(() => {
    loadDashboards();
    setShowInstructions(window.sessionStorage.getItem("showInstructions")==='true' || window.sessionStorage.getItem("showInstructions")==null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function generateComboDashboards(listDashs: IDashboardBase[]) {
    // sort the dashboards on the combo
    const listSortedDashs = listDashs.sort((a:IDashboardBase,b:IDashboardBase) => (a.title!=null&&b.title!=null)?a.title.localeCompare(b.title):0);
    const comboObjects: ComboboxOptionObject[] = listSortedDashs
      .map(({ title, id }) => ({
          label: [title, id].join(' - '),
          value: [title, id].join('.')
      }));
    // set Initial Combo Explore and All
    setAllCombo(comboObjects);
    setCurrentCombo(comboObjects);
    setPrompt(defaultPromptValue);
  }

  const loadDashboards = async () => {
    setLoadingLLM(true);
    setLoadingCombobox(true);
    setErrorMessage(undefined);
    try {
      const result = await generativeDashboardService.listAll();
      setLookerDashboards(result);
      generateComboDashboards(result);
      setLoadingCombobox(false);
      setLoadingLLM(false);
    } catch (error) {
      setLoadingCombobox(false);
      setErrorMessage('Error loading looks');
      setLoadingLLM(false);
    }
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
      const promptResult = await generativeDashboardService.sendPrompt(dashboardElementsData, prompt)
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
                height="500px"              
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
