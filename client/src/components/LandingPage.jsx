import React, { useState, useEffect } from 'react';
import { Brain, PieChart, Wallet, TrendingUp, ChevronRight, ShieldCheck, ArrowRight } from 'lucide-react';
import budgetixLogo from '../assets/image-removebg-preview (4).png';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Background image URL - blue ballpoint pen on paper beside calculator
const bgImageUrl = 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80';

const LandingPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
    
    // Auto-rotate features
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <PieChart className="h-8 w-8 text-blue-500" />,
      title: 'Visual Analytics',
      description: 'Interactive charts and graphs to visualize your spending patterns and financial health at a glance.'
    },
    {
      icon: <Wallet className="h-8 w-8 text-purple-500" />,
      title: 'Budget Planning',
      description: 'Create custom budgets for different categories and track your progress toward financial goals.'
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-green-500" />,
      title: 'AI Insights',
      description: 'Get intelligent suggestions to optimize your spending and increase savings automatically.'
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-amber-500" />,
      title: 'Secure & Private',
      description: 'Your financial data is encrypted and never shared with third parties. Your privacy is our priority.'
    }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Use AuthContext's login function
      const { success, error } = await login(email, password);
      
      if (!success) {
        throw error;
      }
      
      // Login successful - AuthContext will handle the state change
      console.log('Login successful');
    } catch (err) {
      console.error('Login error:', err);
      setError(err?.message || 'Login failed. Please check your credentials.');
      setLoading(false);
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
        
        {/* Animated circles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-blue-400 opacity-70 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-3 h-3 rounded-full bg-purple-400 opacity-70 animate-ping" style={{ animationDuration: '4s', animationDelay: '0s' }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 rounded-full bg-pink-400 opacity-70 animate-ping" style={{ animationDuration: '5s', animationDelay: '2s' }}></div>
      </div>
      
      {/* Header with integrated logo */}
      <header className="relative z-10 container mx-auto px-0 pl-2 py-4">
        <div className="flex justify-start w-full">
          <div className="flex items-center">
            <img 
              src={budgetixLogo} 
              alt="Budgetix Logo" 
              className="h-48 w-auto transition-all duration-300 hover:scale-105" 
              style={{ filter: 'drop-shadow(0 8px 16px rgba(255, 255, 255, 0.4))' }}
            />
          </div>
        </div>
      </header>
      
      {/* Main content - optimized spacing */}
      <main className="relative z-10 container mx-auto px-6 pt-0 pb-16">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left column - Hero content */}
          <div className={`w-full lg:w-1/2 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Smart <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Financial Planning</span> Made Simple
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-lg">
              Take control of your finances with AI-powered insights, beautiful visualizations, and smart recommendations.
            </p>
            
            {/* Features */}
            <div className="space-y-4 mb-8">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className={`flex items-start space-x-4 p-4 rounded-xl transition-all duration-300 cursor-pointer ${activeFeature === index ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5'}`}
                  onClick={() => setActiveFeature(index)}
                >
                  <div className={`p-2 rounded-lg ${activeFeature === index ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-white/10'}`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg flex items-center">
                      {feature.title}
                      {activeFeature === index && <ChevronRight className="h-4 w-4 ml-2" />}
                    </h3>
                    {activeFeature === index && (
                      <p className="text-blue-100 mt-1 animate-fadeIn">
                        {feature.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right column - Login form */}
          <div className={`w-full lg:w-5/12 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-xl">
              <div className="flex items-center justify-center mb-6">
                <img src={budgetixLogo} alt="Budgetix Logo" className="h-20 w-auto" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">Welcome Back</h2>
              <p className="text-blue-100 text-center mb-6">Log in to access your financial dashboard</p>
              
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="mb-4 text-red-300 text-sm text-center font-medium bg-red-900/30 p-3 rounded-lg border border-red-500/30">
                    {error}
                  </div>
                )}
                
                <div className="mb-4">
                  <label className="block mb-2 text-sm font-medium text-blue-100" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500 transition"
                    placeholder="Enter your email"
                    disabled={loading}
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block mb-2 text-sm font-medium text-blue-100" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500 transition"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition mb-4"
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Log In'}
                </button>
                
                <div className="text-center mt-4">
                  <span className="text-blue-100">Don't have an account?</span>
                  <button
                    onClick={() => navigate('/signup')}
                    className="ml-2 text-blue-400 hover:underline font-semibold"
                    type="button"
                  >
                    Sign Up
                  </button>
                </div>
              </form>
              
              {/* Trust indicators */}
              <div className="mt-8 flex items-center justify-center space-x-6">
                <div className="flex items-center">
                  <ShieldCheck className="h-5 w-5 text-blue-300 mr-2" />
                  <span className="text-sm text-blue-200">Secure Login</span>
                </div>
                <div className="flex items-center">
                  <ShieldCheck className="h-5 w-5 text-blue-300 mr-2" />
                  <span className="text-sm text-blue-200">Data Protection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 bg-black/20 backdrop-blur-md mt-auto">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-center items-center">
            <div className="text-sm text-blue-200">© 2025 Budgetix. All rights reserved.</div>
          </div>
        </div>
      </footer>
      
      <style jsx="true">{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
