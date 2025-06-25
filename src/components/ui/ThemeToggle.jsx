import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import TUIButton from './TUIButton'

const ThemeToggle = ({ className = '', style = {} }) => {
  const { themeName, switchTheme, availableThemes } = useTheme()

  const handleToggle = () => {
    const currentIndex = availableThemes.indexOf(themeName)
    const nextIndex = (currentIndex + 1) % availableThemes.length
    switchTheme(availableThemes[nextIndex])
  }

  const getThemeDisplayName = (name) => {
    const displayNames = {
      default: '⚡ TRON',
      tui: '💻 Terminal',
    }
    return displayNames[name] || name
  }

  return (
    <TUIButton
      onClick={handleToggle}
      variant="secondary"
      className={`theme-toggle ${className}`}
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        minWidth: 'auto',
        ...style,
      }}
    >
      {getThemeDisplayName(themeName)}
    </TUIButton>
  )
}

export default ThemeToggle
