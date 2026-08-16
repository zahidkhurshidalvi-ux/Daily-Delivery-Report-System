import React, { useState } from 'react';
import { PostOffice } from '../types';
import { Building, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, Phone, User as UserIcon } from 'lucide-react';

interface PostOfficesManagerProps {
  postOffices: PostOffice[];
  onSaveOffice: (office: PostOffice) => void;
  onToggleStatus: (officeId: string) => void;
  onDeleteOffice: (officeId: string) => void;
}

export const PostOfficesManager: React.FC<PostOfficesManagerProps> = ({
  postOffices,
  onSaveOffice,
  onToggleStatus,
  onDeleteOffice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOffice, setEditingOffice] = useState<PostOffice | null>(null);
  const [deletingOffice, setDeletingOffice] = useState<PostOffice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [postmasterName, setPostmasterName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState(100);

  const filteredOffices = [...postOffices]
    .filter(
      (po) =>
        po.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.postmasterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.mobileNumber.includes(searchTerm)
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

  const handleOpenAdd = () => {
    setEditingOffice(null);
    setName('');
    setPostmasterName('');
    setMobileNumber('03001234567');
    setInitialBalance(100);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (po: PostOffice) => {
    setEditingOffice(po);
    setName(po.name);
    setPostmasterName(po.postmasterName);
    setMobileNumber(po.mobileNumber);
    setInitialBalance(po.initialBalance);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const officeToSave: PostOffice = {
      id: editingOffice ? editingOffice.id : `po-${Date.now()}`,
      name,
      postmasterName: postmasterName.trim() || 'Postmaster',
      mobileNumber: mobileNumber.trim() || '03000000000',
      status: editingOffice ? editingOffice.status : 'ACTIVE',
      initialBalance: Number(initialBalance),
    };

    onSaveOffice(officeToSave);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#00401A] text-white border border-[#005522] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Master Data Management
            </span>
            <span className="text-gray-500 text-xs font-mono">{postOffices.length} Registered Offices</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-1">Post Offices Master Directory</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Manage post office names, postmaster contacts, and operational status.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search office or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006633] w-52"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="bg-[#005522] hover:bg-[#00401A] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Post Office</span>
          </button>
        </div>
      </div>

      {/* Offices Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="p-2.5">#</th>
                <th className="p-2.5">Post Office Name</th>
                <th className="p-2.5">Postmaster Name</th>
                <th className="p-2.5">Mobile Number (WhatsApp)</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
              {filteredOffices.map((po, index) => (
                <tr key={po.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-2.5 text-gray-400 font-mono text-[11px]">{index + 1}</td>
                  <td className="p-2.5 font-bold text-gray-900">{po.name}</td>
                  <td className="p-2.5 text-gray-700">{po.postmasterName}</td>
                  <td className="p-2.5 text-[#006633] font-mono font-bold">{po.mobileNumber}</td>
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => onToggleStatus(po.id)}
                      className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border transition-all ${
                        po.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-800 border-green-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      {po.status}
                    </button>
                  </td>
                  <td className="p-2.5 text-center flex items-center justify-center space-x-1.5">
                    <button
                      onClick={() => handleOpenEdit(po)}
                      className="p-1.5 bg-gray-100 hover:bg-amber-100 text-amber-800 rounded-md border border-gray-200 transition-colors"
                      title="Edit Master Data"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingOffice(po)}
                      className="p-1.5 bg-gray-100 hover:bg-red-100 text-red-600 rounded-md border border-gray-200 transition-colors"
                      title="Delete Post Office"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingOffice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Delete Post Office</h3>
                <p className="text-xs text-gray-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 font-medium mb-5 bg-gray-50 p-3 rounded border border-gray-200">
              Are you sure you want to delete <strong className="text-gray-900">{deletingOffice.name}</strong> from master data directory?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => setDeletingOffice(null)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteOffice(deletingOffice.id);
                  setDeletingOffice(null);
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md shadow-xs flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Office</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl">
            <h3 className="text-base font-extrabold text-gray-900 mb-4 uppercase tracking-tight">
              {editingOffice ? 'Edit Post Office Record' : 'Add New Post Office'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Post Office Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Abbottabad GPO"
                  required
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-md p-2 focus:ring-1 focus:ring-[#006633] focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Postmaster Name</label>
                <input
                  type="text"
                  value={postmasterName}
                  onChange={(e) => setPostmasterName(e.target.value)}
                  placeholder="e.g. Muhammad Ali"
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-md p-2 focus:ring-1 focus:ring-[#006633] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Mobile Number (WhatsApp)</label>
                <input
                  type="text"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 03001234567"
                  className="w-full bg-white border border-gray-300 text-[#006633] font-mono rounded-md p-2 focus:ring-1 focus:ring-[#006633] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#005522] hover:bg-[#00401A] text-white font-bold rounded-md shadow-xs"
                >
                  Save Master Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
