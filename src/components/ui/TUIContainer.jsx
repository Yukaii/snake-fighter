import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const TUIContainer = ({ children, className = '', style = {}, title = '', ...props }) => {
  const { theme, themeName } = useTheme()

  const isTUI = themeName === 'tui'

  const getContainerStyles = () => {
    const baseStyles = {
      padding: theme.spacing.xlarge,
      borderRadius: theme.borderRadius,
      boxShadow: theme.shadows.large,
      ...style,
    }

    if (isTUI) {
      return {
        ...baseStyles,
        background: theme.colors.surface,
        border: `2px solid ${theme.colors.border}`,
        borderRadius: '0px',
        boxShadow: 'none',
        position: 'relative',
      }
    }

    return {
      ...baseStyles,
      background: theme.colors.surface,
      backdropFilter: 'blur(10px)',
    }
  }

  const getTitleStyles = () => ({
    position: 'absolute',
    top: '-12px',
    left: theme.spacing.medium,
    background: theme.colors.surface,
    padding: `0 ${theme.spacing.small}`,
    color: theme.colors.text,
    fontSize: theme.typography.fontSize.small,
    fontFamily: theme.typography.fontFamily,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  })

  return (
    <div style={getContainerStyles()} className={`tui-container ${className}`} {...props}>
      {isTUI && title && <div style={getTitleStyles()}>{title}</div>}
      {children}
    </div>
  )
}

export default TUIContainer
