import React, { useState } from 'react';
import { User, PostOffice } from '../types';
import { Key, Lock, AlertCircle, X } from 'lucide-react';

interface LoginModalProps {
  users: User[];
  postOffices: PostOffice[];
  onLoginSuccess: (user: User) => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ users, postOffices, onLoginSuccess, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    // 1. Check Admin Account
    if (cleanUser.toLowerCase() === 'admin' && cleanPass === 'admin123') {
      const adminUser = users.find((u) => (u.username || '').toLowerCase() === 'admin') || {
        id: 'u-admin',
        username: 'admin',
        passwordHash: 'admin123',
        role: 'ADMIN' as const,
        name: 'Divisional Superintendent',
      };
      onLoginSuccess(adminUser);
      return;
    }

    // 2. Check Users list
    const foundUser = users.find(
      (u) => (u.username || '').toLowerCase() === cleanUser.toLowerCase() && u.passwordHash === cleanPass
    );
    if (foundUser) {
      onLoginSuccess(foundUser);
      return;
    }

    // 3. Check Post Office Master list
    const foundOffice = postOffices.find((po) => {
      const poObj = po as any;
      const matchUsername = poObj.username && String(poObj.username).toLowerCase() === cleanUser.toLowerCase();
      const matchCode = poObj.code && String(poObj.code).toLowerCase() === cleanUser.toLowerCase();
      const matchName = po.name && String(po.name).toLowerCase() === cleanUser.toLowerCase();
      const matchId = po.id && String(po.id).toLowerCase() === cleanUser.toLowerCase();
      const matchPass = (poObj.password || 'post123') === cleanPass;

      return (matchUsername || matchCode || matchName || matchId) && matchPass;
    });

    if (foundOffice) {
      if (foundOffice.status === 'INACTIVE') {
        setErrorMessage('This Post Office account is currently INACTIVE. Contact Superintendent.');
        return;
      }
      const poObj = foundOffice as any;
      onLoginSuccess({
        id: foundOffice.id || `u-${foundOffice.name}`,
        username: poObj.username || poObj.code || foundOffice.name,
        passwordHash: poObj.password || 'post123',
        role: 'POST_OFFICE',
        officeName: foundOffice.name,
        name: foundOffice.postmasterName || 'Postmaster',
      });
      return;
    }

    setErrorMessage('Invalid Username or Password.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white border border-gray-300 rounded-lg p-7 shadow-xl space-y-5">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors"
            title="Close Login Modal"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 bg-[#00401A] border-2 border-yellow-400 text-yellow-400 rounded-full flex items-center justify-center mx-auto shadow-xs font-black text-lg">
            PAK
          </div>
          <h1 className="text-lg font-black text-gray-900 tracking-tight uppercase">PAKISTAN POST</h1>
          <p className="text-xs text-[#006633] font-extrabold uppercase tracking-wider">
            Superintendent Admin Authentication
          </p>
          <p className="text-[11px] text-gray-500 font-medium">
            Sign in to access admin tabs, post offices management, and configuration settings
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md flex items-center space-x-2 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-gray-700 font-bold mb-1">Username / Office Code</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or ISB_GPO"
                required
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-md p-2.5 pl-9 focus:outline-none focus:ring-1 focus:ring-[#006633] font-mono"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-md p-2.5 pl-9 focus:outline-none focus:ring-1 focus:ring-[#006633] font-mono"
              />
              <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#005522] hover:bg-[#00401A] text-white font-bold py-3 rounded-md transition-all shadow-xs text-xs tracking-wider uppercase"
          >
            Authenticate & Sign In
          </button>
        </form>
      </div>
    </div>
  );
};
