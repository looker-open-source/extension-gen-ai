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
import type { ILook } from '@looker/sdk'
import { List, Heading, Box, ListItem, Text } from '@looker/components'

interface LookListProps {
  looks: ILook[]
  loading: boolean
  selectLook: (look: ILook) => void
  currentLookId?: string
}

export const LookList: React.FC<LookListProps> = ({
  looks,
  selectLook,
  loading,
  currentLookId,
}) => (
  <Box m="small" width={200}>
    <Heading as="h3" mb="small">
      Looks
    </Heading>
    {loading ? (
      <Text mr="large">Loading...</Text>
    ) : (
      <List>
        {looks.map((look) =>
          look.id !== undefined ? (
            <ListItem
              key={look.id}
              selected={look.id === currentLookId}
              onClick={() => selectLook(look)}
            >
              {look.title}
            </ListItem>
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
