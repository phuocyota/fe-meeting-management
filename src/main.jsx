import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Áp giao diện đã chọn trước khi render để không nhấp nháy; mặc định là tối.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem('ichi-theme') === 'light' ? 'light' : 'dark'
} catch {
  document.documentElement.dataset.theme = 'dark'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
