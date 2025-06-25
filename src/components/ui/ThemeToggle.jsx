import { Monitor, Palette, Terminal } from 'phosphor-react'
import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const ThemeToggle = ({ className = '', style = {} }) => {
  const { themeName, switchTheme, availableThemes } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const getThemeIcon = (name) => {
    const icons = {
      default: <Monitor size={16} />,
      tui: <Terminal size={16} />,
    }
    return icons[name] || <Palette size={16} />
  }

  const getThemeDisplayName = (name) => {
    const displayNames = {
      default: 'TRON',
      tui: 'Terminal',
    }
    return displayNames[name] || name
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div
      ref={dropdownRef}
      className={`theme-toggle ${className}`}
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '6px',
          color: 'white',
          padding: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(0, 0, 0, 0.9)'
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(0, 0, 0, 0.7)'
          e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'
        }}
      >
        {getThemeIcon(themeName)}
        <span style={{ display: window.innerWidth > 480 ? 'inline' : 'none' }}>
          {getThemeDisplayName(themeName)}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '4px',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '6px',
            backdropFilter: 'blur(10px)',
            minWidth: '120px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          {availableThemes.map((theme) => (
            <button
              type="button"
              key={theme}
              onClick={() => {
                switchTheme(theme)
                setIsOpen(false)
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: theme === themeName ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                borderRadius:
                  theme === availableThemes[0]
                    ? '6px 6px 0 0'
                    : theme === availableThemes[availableThemes.length - 1]
                      ? '0 0 6px 6px'
                      : '0',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (theme !== themeName) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (theme !== themeName) {
                  e.target.style.background = 'transparent'
                }
              }}
            >
              {getThemeIcon(theme)}
              {getThemeDisplayName(theme)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ThemeToggle
