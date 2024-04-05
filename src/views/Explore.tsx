/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import {
    Button,
    ComponentsProvider, Dialog, DialogLayout, FieldSelect, FieldTextArea, IconButton, Space,
    SpaceVertical,
    Spinner, TextArea
} from '@looker/components';
import { LookerEmbedSDK } from '@looker/embed-sdk';
import { ExtensionContext, ExtensionContextData } from '@looker/extension-sdk-react';
import * as Icons from '@styled-icons/material';
import React, { FormEvent, useCallback, useContext, useEffect, useState } from 'react';
import { StateContextType } from '../@types/settings';
import { StateContext } from '../context/settingsContext';
import LookerExploreDataModel from '../models/LookerExploreData';
import { ExploreService, FieldMetadata } from '../services/ExploreService';
import { PromptTemplateService, PromptTemplateTypeEnum } from '../services/PromptTemplateService';
import { Logger } from '../utils/Logger';
import { EmbedContainer } from './EmbedContainer';
import './../assets/style.css';
/**
 * Looker GenAI - Explore Component
 */
export const Explore: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const [loadingLLM, setLoadingLLM] = useState<boolean>(false)
  const [currentModelName, setCurrentModelName] = useState<string>()
  const [currentExploreName, setCurrentExploreName] = useState<string>()
  const [exploreDivElement, setExploreDivElement] = useState<HTMLDivElement>()
  const [hostUrl, setHostUrl] = useState<string>()
  const [llmInsights, setLlmInsights] = useState<string>()
  const { configSettings, exploreComboPromptExamples, explorePromptExamples, exploreComboModels,
    exploreCurrentComboModels,selectedModelExplore ,setExploreCurrentComboModels,
    setSelectedModelExplore, prompt, setPrompt, llmModelSize,
    checkUseNativeBQ, setShowError, setErrorMessage } = React.useContext(StateContext) as StateContextType;

  const [currentFields, setCurrentFields] = useState<FieldMetadata[]>();
  const [currentExploreData, setCurrentExploreData] = useState<LookerExploreDataModel>();
  const [generativeExploreService, setGenerativeExploreService] = useState<ExploreService>();


  useEffect(() => {
    loadExplores();
  }, [])

  const loadExplores = async () => {
    Logger.debug("Loading Explores");
    setExploreCurrentComboModels(exploreComboModels);
    if(selectedModelExplore)
    {
      selectComboExplore(selectedModelExplore);
    }    

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
  }


  const selectComboExplore = ((selectedValue: string) => {
    const splittedArray = selectedValue.split(".");
    if(splittedArray.length > 0 && splittedArray[0]!=null && splittedArray[1]!=null){
      setCurrentModelName(splittedArray[0]);
      setCurrentExploreName(splittedArray[1]);
    }
    else{
      Logger.error("Error selecting combobox, modelName and exploreName are null or not divided by .");
      setErrorMessage("Error selecting combobox, modelName and exploreName are null or not divided by .");
      setShowError(true);
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

  const extensionContext = useContext<ExtensionContextData>(ExtensionContext);


  const embedCtrRef = useCallback((el) => {
    setHostUrl(extensionContext?.extensionSDK?.lookerHostData?.hostUrl);
    // set the explore div element outside
    setExploreDivElement(el);
  }, [])

  function handleThumbs(upDown: boolean) {
    try {
      if(generativeExploreService == null)
      {
        throw new Error("generativeExploreService is null");
      }
      if(currentExploreData == null)
      {
        throw new Error("currentExploreData is null");
      }
      if(currentFields == null)
      {
        throw new Error("currentFields is null");
      }
      generativeExploreService!.logLookerFilterFields(currentFields!, prompt, currentExploreData!, upDown?1:0);
    } catch (error: any) {
      const errorMessage: string = error?.message || "unknown error message";
      setErrorMessage(errorMessage);
      setShowError(true);
      Logger.error("unable to handle thumbs action", errorMessage);
    }
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
    try {
      const startTime = performance.now();
      handleClearAll();
      setLoadingLLM(true);
      // 1. Generate Prompt based on the current selected Looker Explore (Model + ExploreName)
      Logger.info("getting the metadata from looker from the selected explorer");
      if(!currentModelName || !currentExploreName)
      {
        throw new Error('missing model / explore name');
      }
      if (!generativeExploreService) {
        throw new Error('missing explore service');
      }
      const {
        viewName,
        fieldDefinitions,
      } = await generativeExploreService.getExplorerFieldDefinitions(currentModelName, currentExploreName);

      setCurrentFields(fieldDefinitions);

      if (!prompt) {
        throw new Error('missing user prompt, unable to create query');
      }
      Logger.info("generate prompts and send to bigquery");

      const exploreData: LookerExploreDataModel = await generativeExploreService.generateExploreData(fieldDefinitions, prompt);
      const exploreQuery = await generativeExploreService.createExploreQuery(exploreData, currentModelName, viewName!);
      if (!hostUrl) {
        throw new Error('unable to find correct looker hostname to generate explore URL');
      }
      const exploreURL = exploreQuery.generateExploreURL(hostUrl);
      // Update the Explore with New QueryId
      LookerEmbedSDK.init(hostUrl);
      LookerEmbedSDK.createExploreWithUrl(exploreURL)
                    .appendTo(exploreDivElement!)
                    .build()
                    .connect();
      setCurrentExploreData(exploreData);
      generativeExploreService.logLookerFilterFields(fieldDefinitions, prompt, exploreData, 0);
      // Try to see if I can answer the question in text format the same way as dashboard and getting data from the queryId
      Logger.debug("Async try to set the LLM Insight after explore is on");
      try
      {
        const insight = await generativeExploreService.answerQuestionWithData(prompt, exploreQuery.queryId);
        setLlmInsights(insight);
      }
      catch(error: any) {
        const errorMessage: string = error?.message || "unknown error message";
        Logger.error("Failed to get LLM Insight Output ", errorMessage);
        setErrorMessage(errorMessage);
        setShowError(true);
      }

      const endTime = performance.now();
      const elapsedTime = (endTime - startTime)/1000;
      Logger.info(`Elapsed to render explore: ${elapsedTime} s`);
    } catch (error: any) {
      const errorMessage: string = error?.message || "unknown error message";
      Logger.error('unable load LLM explore response', errorMessage);
      setErrorMessage(errorMessage);
      setShowError(true);

    } finally {
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
              className="prompt-input-area"
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
                className="prompt-input-area"
                placeholder="[Experimental] LLM Text Answer"
                value={llmInsights}
                readOnly
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
