/**
 * Copyright (c) 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import { Box, Combobox, ComboboxInput, ComboboxList, ComboboxOption, ComponentsProvider, FieldCheckbox, FieldTextArea, Heading, Label, MaybeComboboxOptionObject, MixedBoolean, Space, SpaceVertical, Span } from '@looker/components'
import React, { FormEvent, useContext, useEffect, useState } from 'react'
import { PromptTemplateService, PromptTemplateTypeEnum } from '../services/PromptTemplateService'
import { Logger } from '../utils/Logger'
import { PromptService } from '../services/PromptService'
import { ExtensionContext } from '@looker/extension-sdk-react'


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

  const { core40SDK } =  useContext(ExtensionContext)
  const promptService: PromptService = new PromptService(core40SDK);
  

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Every time it reloads
    const customPrompt = JSON.parse(window.sessionStorage.getItem(storageCustomPrompt)!)
    const promptService = new PromptTemplateService(customPrompt);
    setCustomPrompt(promptService.getByType(PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS));
    const cStorageNativeBQML = window.sessionStorage.getItem(storageNativeBQML) === "true" || window.sessionStorage.getItem(storageNativeBQML) === null;
    const cStorageShowInstructions = window.sessionStorage.getItem(storageShowInstructions) === "true" || window.sessionStorage.getItem(storageShowInstructions) === null;
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
    Logger.debug(comboboxComponent.value);
  }

  return (
    <ComponentsProvider>
      <Space around>
        <Span fontSize="xxxxxlarge">
          {message}
        </Span>
      </Space>
      <Space around>
        <Heading fontWeight="semiBold">Looker GenAI Extension</Heading>
      </Space>
      <Box display="flex" m="large">
          <SpaceVertical>
          <Span fontSize="x-large">
          Extension Settings
          </Span>
          <Span fontSize="medium">
          Any doubts or feedback or bugs, send it to <b>looker-genai-extension@google.com</b>
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

          {/* TODO: implement fine tuned model and option to change  */}
          {/* <FieldCheckbox
            label="Yes - Use Native BQML Method - Fine Tuned not implemented"
            checked={usingNativeBQML}
            onChange={() => {
              window.sessionStorage.setItem(storageNativeBQML, usingNativeBQML?"false": "true");
              setUsingNativeBQML(!usingNativeBQML);
            }}
          /> */}

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
