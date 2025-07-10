import React, { useState, useEffect } from "react";
import { useAuth } from '../context/AuthContext';
import budgetixLogo from '../assets/image-removebg-preview (4).png';
import SignupModal from './SignupModal';

const Login = () => {
  // Use AuthContext for authentication
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [showSignupModal, setShowSignupModal] = useState(false);
  
  // Clear messages when opening/closing modal
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [showSignupModal]);

  const loginUser = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Use AuthContext login function
      const { success, error } = await login(email, password);
      
      if (!success) {
        throw error;
      }
      
      console.log('Login successful!');
      // No need to call onLogin() as AuthContext handles the state
    } catch (err) {
      console.error('Login error:', err);
      setError(err?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      loginUser();
    } else {
      setError(`Please enter both email and password.`);
    }
  };
  
  // Handler to open signup modal
  const handleOpenSignupModal = () => {
    setShowSignupModal(true);
  };
  
  // Handler to close signup modal
  const handleCloseSignupModal = () => {
    setShowSignupModal(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-6">
            <img 
              src={budgetixLogo} 
              alt="Budgetix Logo" 
              className="h-48 w-auto transition-all duration-300 hover:scale-105" 
              style={{ filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.2))' }}
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
          <p className="text-gray-600 text-center">{isSignup ? 'Sign up for Budgetix' : 'Sign in to your Budgetix dashboard'}</p>
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
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="text-center mt-4">
          <span className="text-gray-600">Don't have an account?{' '}
            <button
              className="text-blue-600 hover:underline font-semibold"
              onClick={handleOpenSignupModal}
              disabled={loading}
            >
              Sign up
            </button>
          </span>
        </div>
        
        {/* Sign-up Modal */}
        <SignupModal 
          isOpen={showSignupModal} 
          onClose={handleCloseSignupModal} 
        />
      </div>
    </div>
  );
};

export default Login; 