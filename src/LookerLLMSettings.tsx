// Copyright 2023 Google LLC

import React, { useContext, useEffect, useState , FormEvent } from 'react'
import { 
  ComponentsProvider,
  FieldTextArea,
  Space,
  Span,
  SpaceVertical,  
  FieldCheckbox,
  MixedBoolean,
} from '@looker/components'
import { ExtensionContext , ExtensionContextData } from '@looker/extension-sdk-react'
import { Box, Heading } from '@looker/components'
import { PromptService, PromptTypeEnum } from './services/PromptService'

/**
 * A simple component that uses the Looker SDK through the extension sdk to display a customized hello message.
 */
export const LookerLLMSettings: React.FC = () => {
  const { core40SDK } =  useContext(ExtensionContext)
  const [message, setMessage] = useState('')
  const [singleExploreMode, setSingleExploreMode] = useState(true as MixedBoolean);
  const [usingNativeBQML, setUsingNativeBQML] = useState(true as MixedBoolean)
  const [customPrompt, setCustomPrompt] = useState<string>();
  const [bananaState, setBananaState] = useState(true as MixedBoolean);

  const storageNativeBQML = "usingNativeBQML";
  const storageSingleExplore = "singleExplore";
  const storageCustomPrompt = "customPrompt";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Every time it reloads
    const promptService = new PromptService(JSON.parse(window.sessionStorage.getItem(storageCustomPrompt)!));
    console.log("Use effect Initial");    
    setCustomPrompt(promptService.getPromptTemplateByType(PromptTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS));
    const cStorageNativeBQML = window.sessionStorage.getItem(storageNativeBQML) === "true";
    const cStorageSingleExplore = window.sessionStorage.getItem(storageSingleExplore) === "true";
    if(cStorageNativeBQML!= null)
    {      
      setUsingNativeBQML(cStorageNativeBQML);
    }
    if(cStorageSingleExplore!=null)
    {
      setSingleExploreMode(cStorageSingleExplore);    
    }

  }, [])
  
  const extensionContext = useContext<ExtensionContextData>(ExtensionContext);

  const handleChangePrompt = (e: FormEvent<HTMLTextAreaElement>) => {    
    setCustomPrompt(e.currentTarget.value);    
    const tempCustomPrompt: { [key in PromptTypeEnum]?: string } = {
      [PromptTypeEnum.FIELDS_FILTERS_PIVOTS_SORTS]: e.currentTarget.value
    }
    window.sessionStorage.setItem(storageCustomPrompt, JSON.stringify(tempCustomPrompt));       
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
          Extension Settings
          </Span>            
          <Span fontSize="medium">
          Any doubts or feedback or bugs, send it to <b>gricardo@google.com</b> or <b>gimenes@google.com</b>
          </Span>
          <FieldCheckbox
            label="Single Explore Mode"
            checked={singleExploreMode}
            onChange={() => {          
              window.sessionStorage.setItem(storageSingleExplore, singleExploreMode?"false": "true");
              setSingleExploreMode(!singleExploreMode);
            }
              }
          />
          <FieldCheckbox
            label="Yes - Use Native BQML Method, and No: use Fine tuned model"
            checked={usingNativeBQML}            
            onChange={() => {             
              window.sessionStorage.setItem(storageNativeBQML, usingNativeBQML?"false": "true");
              setUsingNativeBQML(!usingNativeBQML);              
            }}
          />          
          <FieldTextArea            
            width="100%"
            height="500px"
            label="Prompt Template"  
            value={customPrompt}
            onChange={handleChangePrompt}
          />                                         
        </SpaceVertical>                                   
      </Box>

    </ComponentsProvider>
  )
}
