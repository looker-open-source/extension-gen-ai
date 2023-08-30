// Copyright 2023 Google LLC

import React, {createContext} from 'react'
import { ComponentsProvider, Tabs2, Tab2 } from "@looker/components";
import { ExtensionProvider} from '@looker/extension-sdk-react'
import { hot } from 'react-hot-loader/root'

import { Explore } from './Explore'
import { Dashboard } from './Dashboard'
import { Settings } from './Settings'

const ObjectContext = createContext<any | null>(null);


// customized chattyTimeout (promises inside extension to 5 min for LLM models)
export const App = hot(() => (
  <ExtensionProvider chattyTimeout={300000}>
    <ComponentsProvider>
      <Tabs2 defaultTabId="explore">
        <Tab2 id="explore" label="Generative Explores" >
          <Explore />
        </Tab2>
        <Tab2 id="dashboards" label="Generative Insights on Dashboards">
        <Dashboard/>
        </Tab2>
        <Tab2 id="settings" label="Extension Settings">
        <Settings/>
        </Tab2>
      </Tabs2>
    </ComponentsProvider>
  </ExtensionProvider>
))
