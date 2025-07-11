import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import budgetixLogo from '../assets/image-removebg-preview (4).png';

const bgImageUrl = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80';

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const { email, password, username } = form;
    const result = await signup(email, password, { data: { username } });
    setLoading(false);
    if (result.success) {
      setSuccess('Sign up successful! Please check your email to confirm your account.');
      setForm({ username: '', email: '', password: '' });
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } else {
      setError(result.error?.message || 'Sign up failed.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white overflow-hidden relative">
      {/* Background image with reduced opacity */}
      <div 
        className="absolute inset-0 z-0 opacity-25" 
        style={{
          backgroundImage: `url(${bgImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          mixBlendMode: 'overlay',
        }}
      ></div>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -right-40 w-80 h-80 rounded-full bg-blue-500 opacity-20 blur-3xl"></div>
        <div className="absolute top-60 -left-20 w-60 h-60 rounded-full bg-purple-500 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-20 right-60 w-40 h-40 rounded-full bg-pink-500 opacity-20 blur-3xl"></div>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-blue-400 opacity-70 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-3 h-3 rounded-full bg-purple-400 opacity-70 animate-ping" style={{ animationDuration: '4s', animationDelay: '0s' }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 rounded-full bg-pink-400 opacity-70 animate-ping" style={{ animationDuration: '5s', animationDelay: '2s' }}></div>
      </div>
      {/* Centered glassy signup form */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <img src={budgetixLogo} alt="Budgetix Logo" className="h-20 w-auto" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-center text-white">Sign Up</h2>
          <p className="text-blue-100 text-center mb-6">Create your account to get started</p>
          {error && <div className="mb-4 text-red-300 text-sm text-center font-medium bg-red-900/30 p-3 rounded-lg border border-red-500/30">{error}</div>}
          {success && <div className="mb-4 text-green-300 text-center font-medium bg-green-900/30 p-3 rounded-lg border border-green-500/30">{success}</div>}
          <div className="mb-4">
            <label className="block mb-1 font-medium text-blue-100" htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-white/10 rounded bg-white/5 text-white placeholder-blue-200/50 focus:outline-none focus:ring focus:border-blue-300"
              required
              placeholder="Enter your username"
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-medium text-blue-100" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-white/10 rounded bg-white/5 text-white placeholder-blue-200/50 focus:outline-none focus:ring focus:border-blue-300"
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="mb-6">
            <label className="block mb-1 font-medium text-blue-100" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-white/10 rounded bg-white/5 text-white placeholder-blue-200/50 focus:outline-none focus:ring focus:border-blue-300"
              required
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition" disabled={loading}>
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
          <div className="text-center mt-4">
            <span className="text-blue-100">Already have an account?</span>
            <button
              onClick={() => navigate('/')}
              className="ml-2 text-blue-400 hover:underline font-semibold"
              type="button"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup; 