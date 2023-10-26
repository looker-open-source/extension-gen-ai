/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import styled from 'styled-components'

export const EmbedContainer = styled.div`
  backgroundcolor: #f7f7f7;
  animation: fadeIn ease-in ease-out 3s;
  width: 100%;
  height: 95vh;
  & > iframe {
    width: 100%;
    height: 100%;
    border: 10px;
  }
`
