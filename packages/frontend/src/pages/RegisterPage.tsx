import { useState, FormEvent } from "react";
import { API_BASE_URL } from "../config/constants";

interface RegisterPageProps {
  onSwitchToLogin: () => void;
  onRegisterSuccess: () => void;
}

export const RegisterPage = ({
  onSwitchToLogin,
  onRegisterSuccess,
}: RegisterPageProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.status === 409) {
        throw new Error("An account with that email already exists.");
      }

      if (!res.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      onRegisterSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 bg-opacity-80 border-2 border-cyan-500 rounded-2xl shadow-lg shadow-cyan-500/20">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-white">
            Join the Resistance
          </h2>
          <p className="mt-2 text-gray-400">
            Create your account to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            autoComplete="name"
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            autoComplete="email"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            autoComplete="new-password"
            required
            minLength={6}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition"
            autoComplete="new-password"
            required
            minLength={6}
          />

          {error && (
            <p className="text-red-400 text-center font-semibold">{error}</p>
          )}

          <button
            type="submit"
            className="w-full btn-skittles text-white p-3 rounded-lg font-bold text-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <p className="text-center text-gray-400">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="font-bold text-cyan-400 hover:underline"
          >
            Login here
          </button>
        </p>
      </div>
    </div>
  );
};
