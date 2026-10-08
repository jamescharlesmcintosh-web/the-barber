import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
