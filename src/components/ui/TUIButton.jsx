import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const TUIButton = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  style = {},
  ...props
}) => {
  const { theme, themeName } = useTheme()

  const isTUI = themeName === 'tui'

  const getButtonStyles = () => {
    const baseStyles = {
      padding: `${theme.spacing.medium} ${theme.spacing.large}`,
      margin: theme.spacing.small,
      border: isTUI ? `2px solid ${theme.colors.border}` : 'none',
      borderRadius: theme.borderRadius,
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.fontSize.medium,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: isTUI ? 'none' : 'all 0.3s ease',
      fontWeight: isTUI ? 'bold' : '600',
      textTransform: isTUI ? 'uppercase' : 'none',
      letterSpacing: isTUI ? '1px' : 'normal',
      ...style,
    }

    if (disabled) {
      return {
        ...baseStyles,
        background: isTUI ? theme.colors.surface : '#666',
        color: isTUI ? theme.colors.textSecondary : 'white',
        border: isTUI ? `2px solid ${theme.colors.textSecondary}` : 'none',
        transform: 'none',
        boxShadow: 'none',
      }
    }

    const variantColors = {
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      danger: theme.colors.danger,
    }

    const bgColor = variantColors[variant] || theme.colors.primary

    if (isTUI) {
      return {
        ...baseStyles,
        background: theme.colors.background,
        color: bgColor,
        border: `2px solid ${bgColor}`,
        boxShadow: 'none',
      }
    }

    return {
      ...baseStyles,
      background: 'transparent',
      color: bgColor,
      border: `2px solid ${bgColor}`,
      boxShadow: theme.shadows.small,
      textTransform: 'uppercase',
      letterSpacing: '1px',
    }
  }

  const handleMouseEnter = (e) => {
    if (disabled || themeName !== 'tui') return

    // Only apply custom hover effects for TUI theme
    e.target.style.background = theme.colors.surface
  }

  const handleMouseLeave = (e) => {
    if (disabled || themeName !== 'tui') return

    // Only apply custom hover effects for TUI theme
    e.target.style.background = theme.colors.background
  }

  const handleMouseDown = (e) => {
    if (disabled) return
    // Let CSS handle the effects for TRON theme
  }

  return (
    <button
      style={getButtonStyles()}
      onClick={onClick}
      disabled={disabled}
      className={`tui-button ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      {...props}
    >
      {isTUI && !disabled ? `[ ${children} ]` : children}
    </button>
  )
}

export default TUIButton
