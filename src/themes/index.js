export const themes = {
  default: {
    name: 'TRON',
    colors: {
      primary: '#00d4ff',
      secondary: '#ff6b00',
      danger: '#ff073a',
      background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 70%)',
      surface: 'rgba(0, 212, 255, 0.05)',
      text: '#00d4ff',
      textSecondary: 'rgba(0, 212, 255, 0.7)',
      border: '#00d4ff',
      accent: '#ffff00',
    },
    typography: {
      fontFamily: '"Orbitron", "Exo 2", "Rajdhani", monospace',
      fontSize: {
        small: '14px',
        medium: '16px',
        large: '24px',
        xlarge: '48px',
      },
    },
    spacing: {
      small: '8px',
      medium: '16px',
      large: '24px',
      xlarge: '32px',
    },
    borderRadius: '2px',
    shadows: {
      small: '0 0 10px rgba(0, 212, 255, 0.3)',
      medium: '0 0 20px rgba(0, 212, 255, 0.4)',
      large: '0 0 30px rgba(0, 212, 255, 0.5)',
    },
  },
  tui: {
    name: 'TUI Terminal',
    colors: {
      primary: '#00ff00',
      secondary: '#00ffff',
      danger: '#ff0000',
      background: '#000000',
      surface: '#1a1a1a',
      text: '#00ff00',
      textSecondary: '#ffffff',
      border: '#00ff00',
      accent: '#ffff00',
    },
    typography: {
      fontFamily: '"Courier New", "Monaco", "Menlo", monospace',
      fontSize: {
        small: '12px',
        medium: '14px',
        large: '18px',
        xlarge: '36px',
      },
    },
    spacing: {
      small: '4px',
      medium: '8px',
      large: '16px',
      xlarge: '24px',
    },
    borderRadius: '0px',
    shadows: {
      small: 'none',
      medium: 'none',
      large: 'none',
    },
  },
}

export const defaultTheme = themes.default
