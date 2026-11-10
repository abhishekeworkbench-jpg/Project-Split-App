import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme } from './ui'
import './styles.css'

try { applyTheme(localStorage.getItem('theme') || 'system') } catch { /* storage unavailable */ }
createRoot(document.getElementById('root')).render(<App />)
