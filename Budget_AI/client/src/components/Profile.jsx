import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserCircle } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  if (!user) return <div className="max-w-xl mx-auto p-8">No user info available.</div>;

  // Prefer username from user_metadata if available
  const usernameFromMetadata = user?.user_metadata?.username;
  let displayName = '';
  if (usernameFromMetadata && usernameFromMetadata.trim() !== '') {
    displayName = usernameFromMetadata;
  } else {
    // Extract username from email and remove numeric characters
    const userEmail = user.email || '';
    const username = userEmail.split('@')[0].replace(/[0-9]/g, '');
    displayName = username.charAt(0).toUpperCase() + username.slice(1);
  }

  return (
    <div className="max-w-xl mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-gray-100">
      <div className="flex flex-col items-center mb-6">
        <UserCircle className="h-20 w-20 text-purple-600 mb-2" />
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayName}</h1>
        <p className="text-gray-500">{user.email}</p>
      </div>
      <div className="text-center text-gray-600">
        <p>Welcome to your profile page!</p>
        <p className="mt-2 text-sm">You can view your account information here.</p>
      </div>
    </div>
  );
};

export default Profile; 