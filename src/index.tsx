/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { App } from './views/App'

window.addEventListener('DOMContentLoaded', (_) => {
  const root = document.createElement('div')
  document.body.appendChild(root)
  ReactDOM.render(<App />, root)
})
