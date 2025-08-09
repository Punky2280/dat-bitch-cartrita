import { useState, useEffect } from "react";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ThemeProvider } from "@/context/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import "@/i18n";

type AuthView = "login" | "register";

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("authToken"),
  );
  const [authView, setAuthView] = useState<AuthView>("login");

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) setToken(storedToken);
  }, []);

  const handleLogin = (newToken: string) => {
    localStorage.setItem("authToken", newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
    setAuthView("login");
  };

  const handleRegisterSuccess = () => setAuthView("login");

  return (
    <ErrorBoundary>
      <ThemeProvider>
        {!token ? (
          authView === "login" ? (
            <LoginPage
              onLoginSuccess={handleLogin}
              onSwitchToRegister={() => setAuthView("register")}
            />
          ) : (
            <RegisterPage
              onSwitchToLogin={() => setAuthView("login")}
              onRegisterSuccess={handleRegisterSuccess}
            />
          )
        ) : (
          <DashboardPage token={token} onLogout={handleLogout} />
        )}
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
