import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: ColorScheme;
}

interface ColorScheme {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  border: string;
  messageBubbleSent: string;
  messageBubbleReceived: string;
  messageBubbleSentText: string;
  messageBubbleReceivedText: string;
  inputBackground: string;
  headerBackground: string;
  avatar: string;
  badge: string;
  green: string;
  gray: string;
  red: string;
}

const lightColors: ColorScheme = {
  background: '#FFFFFF',
  surface: '#F9F9F9',
  text: '#000000',
  textSecondary: '#8E8E93',
  primary: '#007AFF',
  border: '#E5E5EA',
  messageBubbleSent: '#007AFF',
  messageBubbleReceived: '#E5E5EA',
  messageBubbleSentText: '#FFFFFF',
  messageBubbleReceivedText: '#000000',
  inputBackground: '#F2F2F7',
  headerBackground: '#F9F9F9',
  avatar: '#007AFF',
  badge: '#FF3B30',
  green: '#34C759',
  gray: '#8E8E93',
  red: '#FF3B30',
};

const darkColors: ColorScheme = {
  background: '#000000',
  surface: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  primary: '#0A84FF',
  border: '#38383A',
  messageBubbleSent: '#0A84FF',
  messageBubbleReceived: '#2C2C2E',
  messageBubbleSentText: '#FFFFFF',
  messageBubbleReceivedText: '#FFFFFF',
  inputBackground: '#1C1C1E',
  headerBackground: '#1C1C1E',
  avatar: '#0A84FF',
  badge: '#FF453A',
  green: '#32D74B',
  gray: '#8E8E93',
  red: '#FF453A',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      console.log('🎨 [THEME] Switched to', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

