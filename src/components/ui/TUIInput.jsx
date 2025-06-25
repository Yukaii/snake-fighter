import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const TUIInput = ({ value, onChange, placeholder = '', className = '', style = {}, ...props }) => {
  const { theme, themeName } = useTheme()

  const isTUI = themeName === 'tui'

  const getInputStyles = () => {
    const baseStyles = {
      padding: theme.spacing.medium,
      margin: theme.spacing.small,
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.fontSize.medium,
      minWidth: '200px',
      outline: 'none',
      transition: isTUI ? 'none' : 'box-shadow 0.3s ease',
      ...style,
    }

    if (isTUI) {
      return {
        ...baseStyles,
        border: `2px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius,
        background: theme.colors.background,
        color: theme.colors.text,
        boxShadow: 'none',
      }
    }

    return {
      ...baseStyles,
      border: 'none',
      borderRadius: theme.borderRadius,
      background: 'white',
      color: '#333',
    }
  }

  const handleFocus = (e) => {
    if (themeName === 'tui') {
      e.target.style.borderColor = theme.colors.accent
    } else {
      e.target.style.boxShadow = '0 0 0 3px rgba(255, 255, 255, 0.3)'
    }
  }

  const handleBlur = (e) => {
    if (themeName === 'tui') {
      e.target.style.borderColor = theme.colors.border
    } else {
      e.target.style.boxShadow = 'none'
    }
  }

  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={isTUI ? `> ${placeholder}` : placeholder}
      style={getInputStyles()}
      className={`tui-input ${className}`}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  )
}

export default TUIInput
