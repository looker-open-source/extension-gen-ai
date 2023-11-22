/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import { Box, Button,  Combobox, ComboboxInput, ComboboxList, ComboboxOption, ComponentsProvider, Dialog, DialogLayout, FieldCheckbox, FieldTextArea, Heading, Label, MaybeComboboxOptionObject, MixedBoolean, Space, SpaceVertical, Span, Spinner } from '@looker/components'
import React, { FormEvent, useContext, useEffect, useState } from 'react'
import { PromptTemplateService, PromptTemplateTypeEnum } from '../services/PromptTemplateService'
import { Logger } from '../utils/Logger'
import { PromptService } from '../services/PromptService'
import { ExtensionContext } from '@looker/extension-sdk-react'
import { ConfigReader, ISettings } from '../services/ConfigReader'
import { StateContextType } from '../@types/settings'
import { StateContext } from '../context/settingsContext'
import { custom } from 'joi'  

/**
 * Settings
 */
export const Settings: React.FC = () => {  
  const [message] = useState('')  
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false)
  const [settings, setSettings] = useState<ISettings>();

  const { core40SDK } =  useContext(ExtensionContext)
  const promptService: PromptService = new PromptService(core40SDK);
  const configReader: ConfigReader = new ConfigReader(core40SDK);
  const [logLevel, setLogLevel] = useState<string>("info");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const { configSettings, saveSettings, resetSettings } = React.useContext(StateContext) as StateContextType;
  
  

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Every time it reloads
    loadSettings(configSettings);    
  }, [])

  const loadSettings = (config:ISettings) => {
    setSettings(config);
    setLogLevel(config?.logLevel!);
    setCustomPrompt(config?.customPrompt!);    
    Logger.setLoggerLevelByName(config?.logLevel!);    
  }

  const handleChangePrompt = (e: FormEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.currentTarget.value);
  }

  const handleChangeCombo= (comboboxComponent: MaybeComboboxOptionObject) => {
    if (!comboboxComponent) {
      throw new Error('missing combobox componenet');
    }
    Logger.setLoggerLevelByName(comboboxComponent.value);
    setLogLevel(comboboxComponent.value);    
    Logger.debug(comboboxComponent.value);
  }

  const handleSaveUserSettings = () =>
  {    
    Logger.debug("Current custom Prompt: "+ customPrompt);
    saveSettings({
      userId: configSettings.userId,
      logLevel: logLevel,
      customPrompt: customPrompt
    });       
  }

  const handleResetDefaultSettings = async () =>
  {        
    const resetConfig = await resetSettings();
    loadSettings(resetConfig);   
  }


  return (
    <ComponentsProvider>          
      <Box display="flex" m="large">
          <SpaceVertical>          
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

          <FieldTextArea
            width="100%"
            height="500px"
            label="Prompt Field, Filters, Sorts - Template for BQML.GENERATE_TEXT"
            value={customPrompt}
            onChange={handleChangePrompt}
          />
          <Space>
            <Button onClick={handleSaveUserSettings}>Save</Button>                     
            <Button id="resetDefaultSettingsButton" color='neutral' onClick={handleResetDefaultSettings}>Reset to Default</Button>                     
          </Space>
          <Dialog isOpen={loadingSettings}>
              <DialogLayout header="Loading Settings...">
                <Spinner size={80}>
                </Spinner>
              </DialogLayout>            
            </Dialog>          
        </SpaceVertical>
      </Box>

    </ComponentsProvider>
  )
}
