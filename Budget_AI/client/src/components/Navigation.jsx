import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Plus, Settings, LogOut, UserCircle, Target } from 'lucide-react';
import budgetixLogo from '../assets/image-removebg-preview (4).png';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  // Get user from AuthContext
  const { user, logout } = useAuth();
  const userEmail = user?.email || 'user@example.com';

  // Prefer username from user_metadata if available
  const usernameFromMetadata = user?.user_metadata?.username;
  let displayName = '';
  if (usernameFromMetadata && usernameFromMetadata.trim() !== '') {
    displayName = usernameFromMetadata;
  } else {
    // Extract username from email and remove numeric characters
    const username = userEmail.split('@')[0].replace(/[0-9]/g, '');
    // Format username for display (capitalize first letter)
    displayName = username.charAt(0).toUpperCase() + username.slice(1);
  }

  // Get first letter for avatar
  const userInitial = displayName.charAt(0).toUpperCase();

  // Display greeting with name
  const greeting = `Hi ${displayName}`;

  // Check profile completeness from localStorage
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  useEffect(() => {
    const checkProfile = () => {
      const stored = localStorage.getItem('profileFinancialInfo');
      if (stored) {
        const { monthlyIncome, totalInvestments, totalSavings } = JSON.parse(stored);
        if (
          monthlyIncome === '' || monthlyIncome === undefined ||
          totalInvestments === '' || totalInvestments === undefined ||
          totalSavings === '' || totalSavings === undefined
        ) {
          setProfileIncomplete(true);
        } else {
          setProfileIncomplete(false);
        }
      } else {
        setProfileIncomplete(true);
      }
    };
    checkProfile();
    window.addEventListener('storage', checkProfile);
    window.addEventListener('profileUpdated', checkProfile);
    return () => {
      window.removeEventListener('storage', checkProfile);
      window.removeEventListener('profileUpdated', checkProfile);
    };
  }, []);

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/budget-manager', icon: Target, label: 'Budget Manager' },
    { path: '/add-expense', icon: Plus, label: 'Add Expense' },
  ];
  
  const handleLogout = async () => {
    // Close dropdown
    setShowDropdown(false);
    
    // Use AuthContext's logout function
    const { success, error } = await logout();
    
    if (success) {
      // Navigate to landing page
      navigate('/');
    } else {
      console.error('Logout failed:', error);
      // Show error notification if needed
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <nav className="bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 shadow-xl border-b border-purple-700 relative">
      <div className="container mx-auto px-0 pl-2">
        <div className="flex items-center justify-between h-20 relative">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img 
                src={budgetixLogo} 
                alt="Budgetix Logo" 
                className="h-24 w-auto mr-2 transition-all duration-300 hover:scale-105" 
                style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
              />
            </Link>
          </div>
          
          <div className="flex items-center space-x-4 mr-2">
            
            {/* Navigation Items */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-5 py-3 rounded-lg transition-all duration-300 ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-md'
                      : 'text-white hover:bg-purple-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            
            {/* User Greeting */}
            <div className="hidden md:flex items-center text-white mr-2">
              <span className="text-purple-200">{greeting}</span>
            </div>
            
            {/* Profile Dropdown */}
            <div className="relative profile-dropdown">
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 border-2 border-purple-300 relative"
                aria-label="Profile menu"
                aria-expanded={showDropdown}
              >
                {userInitial}
                {profileIncomplete && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white">1</span>
                )}
              </button>
              
              {showDropdown && (
                <div 
                  ref={dropdownRef}
                  className="fixed right-4 mt-2 w-56 bg-white rounded-lg shadow-xl z-[1000] py-2 border border-purple-200 overflow-hidden"
                  style={{ top: '70px' }}
                >
                  {/* User info section */}
                  <div className="px-4 py-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-white">
                    <p className="text-sm font-medium text-gray-700">{greeting}</p>
                    <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                  </div>
                  
                  <Link 
                    to="/profile" 
                    className="block px-4 py-2 text-gray-700 hover:bg-purple-50 transition-colors duration-150"
                    onClick={() => setShowDropdown(false)}
                  >
                    <div className="flex items-center space-x-3 relative">
                      <UserCircle className="h-4 w-4 text-purple-600" />
                      <span>Profile</span>
                      {profileIncomplete && (
                        <span className="absolute -top-2 left-16 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white">1</span>
                      )}
                    </div>
                  </Link>
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left block px-4 py-2 text-gray-700 hover:bg-purple-50 transition-colors duration-150 border-t border-gray-100"
                  >
                    <div className="flex items-center space-x-3">
                      <LogOut className="h-4 w-4 text-purple-600" />
                      <span>Logout</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;