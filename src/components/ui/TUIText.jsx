import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const TUIText = ({ children, variant = 'body', className = '', style = {}, ...props }) => {
  const { theme, themeName } = useTheme()

  const isTUI = themeName === 'tui'

  const getTextStyles = () => {
    const baseStyles = {
      fontFamily: theme.typography.fontFamily,
      color: theme.colors.text,
      margin: 0,
      ...style,
    }

    const variants = {
      h1: {
        fontSize: theme.typography.fontSize.xlarge,
        fontWeight: 'bold',
        marginBottom: theme.spacing.xlarge,
        textShadow: isTUI ? 'none' : '2px 2px 4px rgba(0, 0, 0, 0.5)',
        textTransform: isTUI ? 'uppercase' : 'none',
        letterSpacing: isTUI ? '2px' : 'normal',
      },
      h2: {
        fontSize: theme.typography.fontSize.large,
        fontWeight: 'bold',
        marginBottom: theme.spacing.large,
        textShadow: isTUI ? 'none' : '1px 1px 2px rgba(0, 0, 0, 0.5)',
        textTransform: isTUI ? 'uppercase' : 'none',
        letterSpacing: isTUI ? '1px' : 'normal',
      },
      body: {
        fontSize: theme.typography.fontSize.medium,
        lineHeight: '1.5',
      },
      small: {
        fontSize: theme.typography.fontSize.small,
        color: theme.colors.textSecondary,
        opacity: isTUI ? 1 : 0.8,
      },
      accent: {
        fontSize: theme.typography.fontSize.medium,
        color: theme.colors.accent,
        fontWeight: 'bold',
      },
    }

    return {
      ...baseStyles,
      ...variants[variant],
    }
  }

  const getComponent = () => {
    switch (variant) {
      case 'h1':
        return 'h1'
      case 'h2':
        return 'h2'
      default:
        return 'p'
    }
  }

  const Component = getComponent()

  return (
    <Component
      style={getTextStyles()}
      className={`tui-text tui-text-${variant} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}

export default TUIText
