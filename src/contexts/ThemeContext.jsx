import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { defaultTheme, themes } from '../themes'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const savedTheme = localStorage.getItem('snake-fighter-theme')
    return savedTheme && themes[savedTheme] ? themes[savedTheme] : defaultTheme
  })

  const [themeName, setThemeName] = useState(() => {
    const savedThemeName = localStorage.getItem('snake-fighter-theme')
    return savedThemeName || 'default'
  })

  const switchTheme = (newThemeName) => {
    if (themes[newThemeName]) {
      setCurrentTheme(themes[newThemeName])
      setThemeName(newThemeName)
      localStorage.setItem('snake-fighter-theme', newThemeName)
    }
  }

  const getThemeStyles = useCallback(
    () => ({
      '--color-primary': currentTheme.colors.primary,
      '--color-secondary': currentTheme.colors.secondary,
      '--color-danger': currentTheme.colors.danger,
      '--color-background': currentTheme.colors.background,
      '--color-surface': currentTheme.colors.surface,
      '--color-text': currentTheme.colors.text,
      '--color-text-secondary': currentTheme.colors.textSecondary,
      '--color-border': currentTheme.colors.border,
      '--color-accent': currentTheme.colors.accent,
      '--font-family': currentTheme.typography.fontFamily,
      '--font-size-small': currentTheme.typography.fontSize.small,
      '--font-size-medium': currentTheme.typography.fontSize.medium,
      '--font-size-large': currentTheme.typography.fontSize.large,
      '--font-size-xlarge': currentTheme.typography.fontSize.xlarge,
      '--spacing-small': currentTheme.spacing.small,
      '--spacing-medium': currentTheme.spacing.medium,
      '--spacing-large': currentTheme.spacing.large,
      '--spacing-xlarge': currentTheme.spacing.xlarge,
      '--border-radius': currentTheme.borderRadius,
      '--shadow-small': currentTheme.shadows.small,
      '--shadow-medium': currentTheme.shadows.medium,
      '--shadow-large': currentTheme.shadows.large,
    }),
    [currentTheme]
  )

  useEffect(() => {
    const root = document.documentElement
    const styles = getThemeStyles()
    for (const [property, value] of Object.entries(styles)) {
      root.style.setProperty(property, value)
    }
    // Set theme attribute on body for conditional styling
    document.body.setAttribute('data-theme', themeName)
  }, [getThemeStyles, themeName])

  const value = {
    theme: currentTheme,
    themeName,
    switchTheme,
    availableThemes: Object.keys(themes),
    getThemeStyles,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
