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
import {
  TableDataCell,
  Heading,
  Text,
  Box,
  TableHead,
  TableBody,
  Table,
  TableRow,
  TableHeaderCell,
} from '@looker/components'

export interface QueryProps {
  look?: ILook
  results?: Record<any, any>[]
  running: boolean
}

const headings = (results?: Record<any, any>[]): Array<string> => {
  if (!results || !results.length || results.length === 0) {
    return []
  }
  return Object.keys(results[0]).map((key) => key)
}

const values = (results?: Record<any, any>[]): string[][] => {
  if (!results || !results.length || results.length === 0) {
    return []
  }
  return results.map((result) =>
    Object.keys(result).map((key) => `${(result as any)[key]}`)
  )
}

export const QueryContainer: React.FC<QueryProps> = ({
  look,
  results,
  running,
}) => (
  <Box m="small" width="100%">
    <Heading as="h3" mb="small">
      Query:
      {look ? ' ' + look.title : ''}
    </Heading>
    {running && <Text mr="large">Running Query ...</Text>}
    {!running && (
      <Table>
        <TableHead>
          <TableRow>
            {headings(results).map((heading, index) => (
              <TableHeaderCell key={index}>{heading}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {values(results)
            .filter((row) => row.find((column) => column !== ''))
            .map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((column, columnIndex) => (
                  <TableDataCell key={`${rowIndex}-${columnIndex}`}>
                    {column}
                  </TableDataCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    )}
  </Box>
)
