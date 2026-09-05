import React, { createContext, useContext, useEffect, useState } from 'react'

// global light/dark theme — toggled by the "IRIS." wordmark on every page.
// Persisted per browser; the CSS reacts to html[data-theme=...] and the
// React tree reads it via useTheme().
const ThemeCtx = createContext({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (localStorage.getItem('iris.theme') === 'light' ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('iris.theme', theme)
  }, [theme])
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)
