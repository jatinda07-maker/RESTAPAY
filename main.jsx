import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'
import './styles/dashboard.css'
import './styles/sales.css'
import './styles/cost.css'
import { FeedbackProvider } from './components/AppFeedback'
import './styles/records.css'
import { connectLiveData } from './data/liveDataStore.js'

connectLiveData().catch(() => {})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FeedbackProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </FeedbackProvider>
  </React.StrictMode>,
)

