import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Imports explícitos de CSS para asegurar el bundle de producción en Vercel
import './components/ui/Card/Card.css'
import './components/ui/Button/Button.css'
import './components/ui/Input/Input.css'
import './components/ui/Badge/Badge.css'
import './components/ui/Modal/Modal.css'
import './components/ui/LoadingSpinner/LoadingSpinner.css'
import './components/layout/Sidebar/Sidebar.css'
import './pages/LoginPage/LoginPage.css'
import './pages/DashboardPage/DashboardPage.css'
import './pages/SalesPage/SalesPage.css'
import './pages/RecipesPage/RecipesPage.css'
import './pages/ProductionPage/ProductionPage.css'
import './pages/IngredientsPage/IngredientsPage.css'
import './pages/CustomersPage/CustomersPage.css'
import './pages/ProvidersPage/ProvidersPage.css'
import './pages/ShoppingPage/ShoppingPage.css'
import './pages/ExtraCostsPage/ExtraCostsPage.css'
import './pages/ProfilePage/ProfilePage.css'

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
