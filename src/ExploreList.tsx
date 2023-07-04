/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */

import React from 'react'
import type { ILookmlModel } from '@looker/sdk'
import { List, Heading, Box, ListItem, Text } from '@looker/components'

interface ExploreListProps {
  lookmls: ILookmlModel[]
  loading: boolean
  currentExploreName: string
  selectModel: (lookmlModel:ILookmlModel) => void  
  selectCurrentExplore: (exploreName: string) => void
}

export const ExploreList: React.FC<ExploreListProps> = ({
  lookmls,
  selectModel,
  loading,
  selectCurrentExplore,
  currentExploreName
}) => (
  <Box m="small" width={400}>
    <Heading as="h3" mb="small">
      All Explores
    </Heading>
    {loading ? (
      <Text mr="large">Loading...</Text>
    ) : (
      <List>
        {lookmls.map((lookml) =>          
          (lookml.explores !== null && lookml.explores !== undefined) ? (
            lookml.explores.map((explore) => 
              <ListItem
                key={explore.name}
                selected={ lookml === currentExploreName}
                onClick={() => {
                  selectModel(lookml);
                  selectCurrentExplore(explore.name!);
                }}
              >
              {lookml.name} - {explore.name}
              </ListItem>
            )            
          ) : (
            <Text key="error" color="palette.red500">
              Failed to load
            </Text>
          )
        )}
      </List>
    )}
  </Box>
)
