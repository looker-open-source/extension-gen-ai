// Copyright 2023 Google LLC

import React from 'react'
import ReactDOM from 'react-dom'
import { App } from './App'

window.addEventListener('DOMContentLoaded', (_) => {
  const root = document.createElement('div')
  document.body.appendChild(root)
  ReactDOM.render(<App />, root)
})
