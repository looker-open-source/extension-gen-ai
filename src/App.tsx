// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
  * This is a sample Looker Extension written in typescript and React. It imports one component, <HelloWorld>.
  * HelloWorld makes a simple call to the Looker API using the Extension Framework's built in authentication,
  * and returns the logged in user.
*/
import React from 'react';
import { ComponentsProvider, Tabs2, Tab2 } from "@looker/components";
import { ExtensionProvider} from '@looker/extension-sdk-react'
import { hot } from 'react-hot-loader/root'

import { LookerExploreGenerative as LookerExploreGenerative } from './LookerExploreGenerative'
import { LookerDashboardGenerative as LookerDashboardGenerative } from './LookerDashboardGenerative'

export const App = hot(() => (
  <ExtensionProvider>
    <ComponentsProvider>
      <Tabs2 defaultTabId="explore">
        <Tab2 id="explore" label="Looker Generative Explores">
          <LookerExploreGenerative/>
        </Tab2>
        <Tab2 id="dashboards" label="Looker Generative Insights on Dashboards">
        <LookerDashboardGenerative/>
        </Tab2>      
      </Tabs2>  
    </ComponentsProvider>
  </ExtensionProvider>
))
