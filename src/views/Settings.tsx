// Copyright 2023 Google LLC

import { Box, Combobox, ComboboxInput, ComboboxList, ComboboxOption, ComponentsProvider, FieldCheckbox, FieldTextArea, Heading, Label, MaybeComboboxOptionObject, MixedBoolean, Space, SpaceVertical, Span } from '@looker/components'
import React, { FormEvent, useEffect, useState } from 'react'
import { PromptTemplateService, PromptTemplateTypeEnum } from '../services/PromptTemplateService'
import { Logger } from '../utils/Logger'


/**
 * Settings
 */
export const Settings: React.FC = () => {
  const [message] = useState('')
  const [logLevel, setLogLevel] = useState<string>("info");
  const [usingNativeBQML, setUsingNativeBQML] = useState(true as MixedBoolean)
  const [showInstructions, setShowInstructions] = useState(true as MixedBoolean)
  const [customPrompt, setCustomPrompt] = useState<string>();

  const storageShowInstructions = "showInstructions";
  const storageNativeBQML = "usingNativeBQML";
  const storageLogLevel = "logLevel";
  const storageCustomPrompt = "customPrompt";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Every time it reloads
    const customPrompt = JSON.parse(window.sessionStorage.getItem(storageCustomPrompt)!)
    const promptService = new PromptTemplateService(customPrompt);
    setCustomPrompt(promptService.getByType(PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS));
    const cStorageNativeBQML = window.sessionStorage.getItem(storageNativeBQML) === "true" || window.sessionStorage.getItem(storageNativeBQML) === null;
    const cStorageShowInstructions = window.sessionStorage.getItem(storageShowInstructions) === "true" || window.sessionStorage.getItem(storageNativeBQML) === null;
    const cStorageLogLevel = window.sessionStorage.getItem(storageLogLevel);
    if(cStorageNativeBQML!= null)
    {
      setUsingNativeBQML(cStorageNativeBQML);
    }
    if(cStorageLogLevel!=null)
    {
      setLogLevel(cStorageLogLevel);
      Logger.setLoggerLevelByName(cStorageLogLevel);
    }
    if(cStorageShowInstructions!=null)
    {
      setShowInstructions(cStorageShowInstructions);
    }

  }, [])

  const handleChangePrompt = (e: FormEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.currentTarget.value);
    const tempCustomPrompt: { [key in PromptTemplateTypeEnum]?: string } = {
      [PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: e.currentTarget.value
    }
    window.sessionStorage.setItem(storageCustomPrompt, JSON.stringify(tempCustomPrompt));
  }

  const handleChangeCombo= (comboboxComponent: MaybeComboboxOptionObject) => {
    if (!comboboxComponent) {
      throw new Error('missing combobox componenet');
    }
    Logger.setLoggerLevelByName(comboboxComponent.value);
    window.sessionStorage.setItem(storageLogLevel, comboboxComponent.value);
    setLogLevel(comboboxComponent.value);
    console.log(comboboxComponent.value);
  }

  return (
    <ComponentsProvider>
      <Space around>
        <Span fontSize="xxxxxlarge">
          {message}
        </Span>
      </Space>
      <Space around>
        <Heading fontWeight="semiBold"> Looker GenAI Demo: go/lookerllm - Design: go/lookerllm-design</Heading>
      </Space>
      <Box display="flex" m="large">
          <SpaceVertical>
          <Span fontSize="x-large">
          Extension Settings
          </Span>
          <Span fontSize="medium">
          Any doubts or feedback or bugs, send it to <b>gricardo@google.com</b> or <b>gimenes@google.com</b>
          </Span>
          <Label>Console Log Level</Label>
          <Combobox  width={"300px"} value={logLevel} onChange={handleChangeCombo}>
            <ComboboxInput />
            <ComboboxList>
              <ComboboxOption value="trace"/>
              <ComboboxOption value="debug" />
              <ComboboxOption value="info" />
              <ComboboxOption value="warn" />
              <ComboboxOption value="error" />
            </ComboboxList>
          </Combobox>

          <FieldCheckbox
            label="Yes - Use Native BQML Method, and No: use Fine tuned model"
            checked={usingNativeBQML}
            onChange={() => {
              window.sessionStorage.setItem(storageNativeBQML, usingNativeBQML?"false": "true");
              setUsingNativeBQML(!usingNativeBQML);
            }}
          />

           <FieldCheckbox
            label="Show Instructions"
            checked={showInstructions}
            onChange={() => {
              window.sessionStorage.setItem(storageShowInstructions, showInstructions?"false": "true");
              setShowInstructions(!showInstructions);
            }}
          />

          <FieldTextArea
            width="100%"
            height="500px"
            label="Prompt Field, Filters, Sorts - Template for BQML.GENERATE_TEXT"
            value={customPrompt}
            onChange={handleChangePrompt}
          />
        </SpaceVertical>
      </Box>

    </ComponentsProvider>
  )
}
