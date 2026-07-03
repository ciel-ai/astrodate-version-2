import React, { createContext, useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextType = {
  themeMode: ThemeMode;
  theme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isLoaded: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();

  // Strictly align with the mobile system theme settings
  const resolvedTheme = systemScheme === 'dark' ? 'dark' : 'light';

  return (
    <ThemeContext.Provider value={{ themeMode: 'system', theme: resolvedTheme, setThemeMode: async () => {}, isLoaded: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}
