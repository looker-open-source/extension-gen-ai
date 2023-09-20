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
