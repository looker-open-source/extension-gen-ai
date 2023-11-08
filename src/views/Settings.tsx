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


/**
 * Settings
 */
export const Settings: React.FC = () => {  
  const [message] = useState('')
  const [logLevel, setLogLevel] = useState<string>("info");
  const [customPrompt, setCustomPrompt] = useState<string>();  
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false)
  const [settings, setSettings] = useState<ISettings>();

  const { core40SDK } =  useContext(ExtensionContext)
  const promptService: PromptService = new PromptService(core40SDK);
  const configReader: ConfigReader = new ConfigReader(core40SDK);
  
  

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Every time it reloads
    loadSettings();            
  }, [])

  const loadSettings = async () => {
    setLoadingSettings(true);
    var configSettings;
    try
    {
      configSettings = await configReader.getSettings()      
      Logger.info("Settings" + configSettings);
    }
    catch {
      // Load default settings in case of any exception loading from BigQuery
      Logger.debug("Could not load settings from BigQuery. Setting defaults.");
      configSettings = {
        logLevel: "info",
        customPrompt: JSON.stringify({
          [PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: ""
        })
      };
    }    
    
    setSettings(configSettings);
    Logger.info("Settings loaded: " + JSON.stringify(configSettings));
    const customPrompt = configSettings.customPrompt!;
    const customTemplate =  {
      [PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: customPrompt
    };
    const promptService = new PromptTemplateService(customTemplate);
    setCustomPrompt(promptService.getByType(PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS));    
    setLogLevel(configSettings?.logLevel!);
    Logger.setLoggerLevelByName(configSettings?.logLevel!);   
    setLoadingSettings(false);      
  }

  const handleChangePrompt = (e: FormEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.currentTarget.value);
    const tempCustomPrompt: { [key in PromptTemplateTypeEnum]?: string } = {
      [PromptTemplateTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: e.currentTarget.value
    }    
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
    setLoadingSettings(true);
    configReader.updateSettings({
      logLevel: logLevel,
      customPrompt: JSON.stringify(customPrompt)
    });
    setLoadingSettings(false);
  }

  const handleResetDefaultSettings = () =>
  {
    setLoadingSettings(true);
    configReader.resetDefaultSettings();
    loadSettings();
    setLoadingSettings(false);
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
            <Button color='neutral' onClick={handleResetDefaultSettings}>Reset to Default</Button>                     
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
