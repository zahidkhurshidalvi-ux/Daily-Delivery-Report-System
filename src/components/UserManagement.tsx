import React, { useState } from 'react';
import { User, PostOffice } from '../types';
import { Users, ShieldCheck, Key, Lock, CheckCircle2 } from 'lucide-react';

interface UserManagementProps {
  users: User[];
  postOffices?: PostOffice[];
  currentUser?: User | null;
  onChangePassword: (username: string, newPass: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  postOffices = [],
  currentUser,
  onChangePassword,
}) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;

    onChangePassword(selectedUser.username, newPassword);
    setSuccessMsg(`Password for ${selectedUser.username} successfully updated!`);
    setSelectedUser(null);
    setNewPassword('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-50 border border-green-200 text-[#006633] rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">System User Accounts & Credentials</h2>
            <p className="text-xs text-gray-500 font-medium">
              Manage system access permissions and user passwords.
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-xs flex items-center space-x-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#006633]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="p-2.5">Full Name / Designation</th>
                <th className="p-2.5">Username</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5">Assigned Office</th>
                <th className="p-2.5 text-center">Reset Password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-2.5 font-bold text-gray-900">{u.name}</td>
                  <td className="p-2.5 font-mono text-[#006633] font-bold">{u.username}</td>
                  <td className="p-2.5">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                        u.role === 'ADMIN'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-green-50 text-green-800 border-green-200'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-2.5 text-gray-600">{u.officeName || 'All Offices (Superintendent)'}</td>
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="bg-gray-100 hover:bg-amber-100 text-amber-800 px-3 py-1 rounded-md border border-gray-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Reset Pass
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-sm p-6 shadow-xl text-xs">
            <h3 className="text-base font-extrabold text-gray-900 mb-1 uppercase tracking-tight">
              Reset Password for {selectedUser.username}
            </h3>
            <p className="text-gray-500 mb-4 font-medium">
              Enter a new password for {selectedUser.name}.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-gray-700 font-bold mb-1">New Password *</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. post12345"
                  required
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-md p-2 font-mono focus:ring-1 focus:ring-[#006633] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#005522] hover:bg-[#00401A] text-white font-bold rounded-md shadow-xs"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
