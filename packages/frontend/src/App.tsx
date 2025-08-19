import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AdvancedRouter } from "@/routing/AdvancedRouter";
import { SimpleRouter } from "@/routing/SimpleRouter";
import { ThemeProvider } from "@/context/ThemeContext";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { AppProvider } from "@/context/AppContext";
import { PerformanceMonitor } from "@/routing/PerformanceMonitor";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AccessibilityProvider } from "@/services/AccessibilityService";
import { realTimeDataService } from "@/services/RealTimeDataService";
import "@/i18n";

type AuthView = "login" | "register";

function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [authView, setAuthView] = useState<AuthView>("login");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Migration: Move old authToken to new token key
    const oldToken = localStorage.getItem("authToken");
    if (oldToken && !localStorage.getItem("token")) {
      localStorage.setItem("token", oldToken);
      localStorage.removeItem("authToken");
    }
    
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);
    
    // Initialize real-time data service
    if (storedToken) {
      realTimeDataService.connect().catch(console.error);
    }
    
    // Simulate app initialization
    setTimeout(() => setIsLoading(false), 1000);

    // Cleanup on unmount
    return () => {
      realTimeDataService.disconnect();
    };
  }, []);

  const handleLogin = (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    
    // Connect to real-time services after login
    realTimeDataService.connect().catch(console.error);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthView("login");
    
    // Disconnect real-time services on logout
    realTimeDataService.disconnect();
  };

  const handleRegisterSuccess = () => setAuthView("login");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Cartrita</h2>
          <p className="text-slate-400">Initializing AI System...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <AppProvider>
          <ThemeProvider>
            <WebSocketProvider>
              <PerformanceMonitor>
                <div className="app-container" role="application" aria-label="Cartrita AI Assistant">
                  {/* Skip to main content link for accessibility */}
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
                  >
                    Skip to main content
                  </a>
                  
                  <AnimatePresence mode="wait">
                    {!token ? (
                      <motion.div
                        key="auth"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        role="main"
                        id="main-content"
                      >
                        {authView === "login" ? (
                          <LoginPage
                            onLoginSuccess={handleLogin}
                            onSwitchToRegister={() => setAuthView("register")}
                          />
                        ) : (
                          <RegisterPage
                            onSwitchToLogin={() => setAuthView("login")}
                            onRegisterSuccess={handleRegisterSuccess}
                          />
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="app"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        role="main"
                        id="main-content"
                      >
                        <SimpleRouter token={token} onLogout={handleLogout} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </PerformanceMonitor>
            </WebSocketProvider>
          </ThemeProvider>
        </AppProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}

export default App;
