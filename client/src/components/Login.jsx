import React, { useState } from "react";

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [success, setSuccess] = useState("");

  const loginUser = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin();
      } else {
        setError(data.error || data.message || 'Login failed.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const signupUser = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Signup successful! You can now log in.');
        setIsSignup(false);
        setEmail("");
        setPassword("");
      } else {
        setError(data.error || data.message || 'Signup failed.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      if (isSignup) {
        signupUser();
      } else {
        loginUser();
      }
    } else {
      setError(`Please enter both email and password.`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-100 p-3 rounded-full mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
          <p className="text-gray-600 text-center">{isSignup ? 'Sign up for Budget AI' : 'Sign in to your Budget AI dashboard'}</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 text-green-600 text-sm text-center font-medium bg-green-50 p-2 rounded">
              {success}
            </div>
          )}
          <div className="mb-4">
            <label className="block mb-1 font-semibold text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              autoComplete="email"
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>
          <div className="mb-6">
            <label className="block mb-1 font-semibold text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-lg hover:bg-blue-700 transition shadow disabled:opacity-60 mb-2"
            disabled={loading}
          >
            {loading ? (isSignup ? 'Signing up...' : 'Logging in...') : (isSignup ? 'Sign Up' : 'Login')}
          </button>
        </form>
        <div className="text-center mt-4">
          {isSignup ? (
            <span className="text-gray-600">Already have an account?{' '}
              <button
                className="text-blue-600 hover:underline font-semibold"
                onClick={() => { setIsSignup(false); setError(""); setSuccess(""); }}
                disabled={loading}
              >
                Login
              </button>
            </span>
          ) : (
            <span className="text-gray-600">Don't have an account?{' '}
              <button
                className="text-blue-600 hover:underline font-semibold"
                onClick={() => { setIsSignup(true); setError(""); setSuccess(""); }}
                disabled={loading}
              >
                Sign up
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login; 