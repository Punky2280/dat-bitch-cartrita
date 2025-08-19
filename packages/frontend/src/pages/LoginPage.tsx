import { useState, FormEvent } from "react";
import { API_BASE_URL } from "../config/constants";
interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
  onSwitchToRegister: () => void;
}
export const LoginPage = ({
  onLoginSuccess,
  onSwitchToRegister,
}: LoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // 🚨 TEMPORARY FRONTEND BYPASS - Backend auth is currently broken
    // This creates a mock login for immediate testing
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Basic validation
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      if (password.length < 3) {
        throw new Error("Password must be at least 3 characters");
      }

      // Make actual API call to backend
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      console.log("✅ Backend auth successful - user logged in:", data.user);
      
      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }

    /* 🔧 ORIGINAL BACKEND CODE (disabled due to auth server issues)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        throw new Error("Invalid response from server");
      }

      if (res.status === 401) throw new Error("Invalid email or password.");
      if (!res.ok) throw new Error(data?.message || "Login failed.");
      if (!data?.token) throw new Error("No authentication token received.");

      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
    */
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 bg-opacity-80 border-2 border-cyan-500 rounded-2xl shadow-lg shadow-cyan-500/20">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-white">Welcome Back</h2>
          <p className="mt-2 text-slate-400">Log in to access your dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            autoComplete="username"
            required
          />
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="text-red-400 text-center font-semibold">{error}</p>
          )}
          <button
            type="submit"
            className="w-full btn-skittles text-white p-3 rounded-lg font-bold text-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Logging In..." : "Login"}
          </button>
        </form>
  <p className="text-center text-slate-400">
          Don&apos;t have an account?{" "}
          <button
            onClick={onSwitchToRegister}
            className="font-bold text-cyan-400 hover:underline"
          >
            Register here
          </button>
        </p>
      </div>
    </div>
  );
};
