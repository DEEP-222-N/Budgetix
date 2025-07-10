import React, { createContext, useState, useEffect, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

// Direct Supabase connection
const supabase = createClient(
  'https://agchhwydoccsdnwuqwtq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnY2hod3lkb2Njc2Rud3Vxd3RxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDIyMzk2NCwiZXhwIjoyMDU5Nzk5OTY0fQ.nCLX75cAcCfz-VhD1P5R2nzOBjiMusHDbrOYV5zg-c0'
);

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for active session on component mount
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    };
    
    getSession();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session);
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => {
      // Clean up the listener when component unmounts
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error };
    }
  };

  const signup = async (email, password, options = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: options.data || {},
        },
      });
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error };
    }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    supabase
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
