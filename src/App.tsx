// Copyright 2023 Google LLC

import React from 'react';
import { ComponentsProvider, Tabs2, Tab2 } from "@looker/components";
import { ExtensionProvider} from '@looker/extension-sdk-react'
import { hot } from 'react-hot-loader/root'

import { LookerExploreGenerative } from './LookerExploreGenerative'
import { LookerDashboardGenerative } from './LookerDashboardGenerative'
import { LookerLLMSettings } from './LookerLLMSettings'

// customized chattyTimeout (promises inside extension to 5 min for LLM models)
export const App = hot(() => (
  <ExtensionProvider chattyTimeout={300000}>
    <ComponentsProvider>
      <Tabs2 defaultTabId="explore">
        <Tab2 id="explore" label="Generative Explores">
          <LookerExploreGenerative/>
        </Tab2>
        <Tab2 id="dashboards" label="Generative Insights on Dashboards">
        <LookerDashboardGenerative/>
        </Tab2>
        <Tab2 id="settings" label="Extension Settings">
        <LookerLLMSettings/>
        </Tab2>
      </Tabs2>
    </ComponentsProvider>
  </ExtensionProvider>
))
