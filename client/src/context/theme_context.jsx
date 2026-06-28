import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "ui-theme";
const THEMES = {
  DARK: "dark",
  LIGHT: "light",
};

const ThemeContext = createContext(null);

function getInitialTheme() {
  if (typeof window === "undefined") return THEMES.DARK;

  const storedTheme = window.localStorage.getItem(THEME_KEY);
  if (storedTheme === THEMES.LIGHT) return THEMES.LIGHT;

  return THEMES.DARK;
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
    );
  };

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === THEMES.DARK,
      toggleTheme,
      setTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

export { ThemeProvider, useTheme, THEMES };
