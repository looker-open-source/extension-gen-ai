/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import React, {createContext} from 'react'
import { ComponentsProvider, Tabs2, Tab2 } from "@looker/components";
import { ExtensionProvider} from '@looker/extension-sdk-react'
import { hot } from 'react-hot-loader/root'

import { Explore } from './Explore'
import { Dashboard } from './Dashboard'
import { Settings } from './Settings'

const ObjectContext = createContext<any | null>(null);

const getRoot = () => {
  const id = 'extension-root'
  const existingRoot = document.getElementById(id)
  if (existingRoot) return existingRoot
  const root = document.createElement('div')
  root.setAttribute('id', id)
  root.style.height = '100vh'
  root.style.display = 'flex'
  document.body.style.margin = '0'
  document.body.appendChild(root)
  return root
}

// customized chattyTimeout (promises inside extension to 5 min for LLM models)
export const App = hot(() => (
  <ExtensionProvider chattyTimeout={300000}>
    <ComponentsProvider
      themeCustomizations={{
        colors: { key: '#1A73E8' },
        defaults: { externalLabel: false },
      }}>
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
