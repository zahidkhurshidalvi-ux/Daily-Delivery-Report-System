import React, { useState, useRef } from 'react';
import { PostOffice } from '../types';
import {
  Building,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  User as UserIcon,
  Upload,
  Download,
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet,
  Check,
} from 'lucide-react';

interface PostOfficesManagerProps {
  postOffices: PostOffice[];
  onSaveOffice: (office: PostOffice) => void;
  onToggleStatus: (officeId: string) => void;
  onDeleteOffice: (officeId: string) => void;
  onBulkImportOffices?: (offices: PostOffice[], replaceExisting: boolean) => void;
  onClearAllOffices?: () => void;
  onResetDefaultOffices?: () => void;
}

export const PostOfficesManager: React.FC<PostOfficesManagerProps> = ({
  postOffices,
  onSaveOffice,
  onToggleStatus,
  onDeleteOffice,
  onBulkImportOffices,
  onClearAllOffices,
  onResetDefaultOffices,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOffice, setEditingOffice] = useState<PostOffice | null>(null);
  const [deletingOffice, setDeletingOffice] = useState<PostOffice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Bulk Import State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTextInput, setBulkTextInput] = useState('');
  const [bulkMode, setBulkMode] = useState<'replace' | 'append'>('replace');
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State for Single Add/Edit
  const [name, setName] = useState('');
  const [postmasterName, setPostmasterName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState(0);

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
    setInitialBalance(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (po: PostOffice) => {
    setEditingOffice(po);
    setName(po.name);
    setPostmasterName(po.postmasterName);
    setMobileNumber(po.mobileNumber);
    setInitialBalance(po.initialBalance || 0);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const officeToSave: PostOffice = {
      id: editingOffice ? editingOffice.id : `po-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      postmasterName: postmasterName.trim() || 'Postmaster',
      mobileNumber: mobileNumber.trim() || '03000000000',
      status: editingOffice ? editingOffice.status : 'ACTIVE',
      initialBalance: Number(initialBalance) || 0,
    };

    onSaveOffice(officeToSave);
    setIsModalOpen(false);
  };

  // Process and parse bulk office text
  const handleProcessBulkImport = () => {
    if (!bulkTextInput.trim()) return;

    const lines = bulkTextInput.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedOffices: PostOffice[] = [];

    lines.forEach((line, idx) => {
      // Check if comma/tab/pipe separated: "Office Name, Mobile, Postmaster"
      const parts = line.split(/[,|\t]+/).map((p) => p.trim());
      const poName = parts[0];
      const poMobile = parts[1] || `030012345${String(idx + 1).padStart(2, '0')}`;
      const poMaster = parts[2] || 'Postmaster';

      if (poName) {
        parsedOffices.push({
          id: `po-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          name: poName,
          postmasterName: poMaster,
          mobileNumber: poMobile,
          status: 'ACTIVE',
          initialBalance: 0,
        });
      }
    });

    if (parsedOffices.length > 0 && onBulkImportOffices) {
      onBulkImportOffices(parsedOffices, bulkMode === 'replace');
      setImportSuccessMsg(`Successfully imported ${parsedOffices.length} post offices!`);
      setTimeout(() => {
        setIsBulkModalOpen(false);
        setImportSuccessMsg('');
        setBulkTextInput('');
      }, 1200);
    }
  };

  // Handle CSV/Text File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBulkTextInput(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Export Post Offices to CSV
  const handleExportCSV = () => {
    const headers = ['Sr #', 'Post Office Name', 'Postmaster Name', 'Mobile Number', 'Status', 'Initial Balance'];
    const rows = filteredOffices.map((po, index) => [
      index + 1,
      `"${po.name.replace(/"/g, '""')}"`,
      `"${po.postmasterName.replace(/"/g, '""')}"`,
      `"${po.mobileNumber}"`,
      po.status,
      po.initialBalance || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pakistan_Post_Offices_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#00401A] text-white border border-[#005522] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Master Data Directory
            </span>
            <span className="text-gray-600 text-xs font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">
              {postOffices.length} Registered Offices
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-1">Post Offices Master Management</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Manage, add, bulk import, or customize your exact post offices list without dummy test data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search office or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006633] w-48"
            />
          </div>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-xs transition-all flex items-center space-x-1.5"
            title="Bulk import post offices from list or CSV"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Import / Paste</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs px-3 py-2 rounded-lg border border-gray-300 transition-all flex items-center space-x-1.5"
            title="Download offices list as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="bg-[#005522] hover:bg-[#00401A] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single Office</span>
          </button>
        </div>
      </div>

      {/* Directory Action Utility Bar */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-lg text-xs">
        <div className="flex items-center space-x-2 text-gray-600 font-medium">
          <Building className="w-4 h-4 text-[#006633]" />
          <span>Alphabetical A-Z Ordering is automatically applied to all portals & dropdowns.</span>
        </div>
        <div className="flex items-center space-x-2">
          {onResetDefaultOffices && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 px-2.5 py-1 rounded text-[11px] font-semibold flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Standard 30 Offices</span>
            </button>
          )}
          {onClearAllOffices && postOffices.length > 0 && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded text-[11px] font-semibold flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All Offices</span>
            </button>
          )}
        </div>
      </div>

      {/* Offices Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {filteredOffices.length === 0 ? (
          <div className="p-12 text-center">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-800">No Post Offices Found</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
              {postOffices.length === 0
                ? 'Your master directory is currently empty. Add your exact offices or click Bulk Import to paste your 40 offices list.'
                : 'No offices matched your search query.'}
            </p>
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs flex items-center space-x-1.5"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Import Offices</span>
              </button>
              <button
                onClick={handleOpenAdd}
                className="bg-[#005522] hover:bg-[#00401A] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Single Office</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Post Office Name</th>
                  <th className="p-2.5">Postmaster / Incharge</th>
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
                    <td className="p-2.5 text-center space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(po)}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-200 transition-colors"
                        title="Edit Office Details"
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
        )}
      </div>

      {/* Bulk Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Bulk Import Post Offices</h3>
                  <p className="text-[11px] text-gray-500">Paste your office list or upload CSV / text file</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {importSuccessMsg ? (
              <div className="p-6 text-center text-green-700 bg-green-50 rounded-lg border border-green-200 flex flex-col items-center">
                <Check className="w-10 h-10 text-green-600 mb-2" />
                <p className="font-bold text-sm">{importSuccessMsg}</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-gray-800">
                      Paste Office Names (One per line or Comma Separated):
                    </label>
                    <label className="cursor-pointer text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Upload CSV / TXT</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                  <textarea
                    rows={8}
                    value={bulkTextInput}
                    onChange={(e) => setBulkTextInput(e.target.value)}
                    placeholder={`Gujranwala GPO, 03001234501, Postmaster\nDaska GPO, 03001234502\nSambrial PO\nWazirabad GPO\nKamoke PO\nSialkot GPO`}
                    className="w-full bg-gray-50 border border-gray-300 font-mono text-[11px] text-gray-900 rounded-lg p-3 focus:bg-white focus:ring-2 focus:ring-[#006633] focus:outline-none"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Format: <code className="bg-gray-100 px-1 py-0.5 rounded font-bold">Office Name, Mobile Number, Postmaster Name</code> (Mobile and Postmaster are optional).
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="block font-bold text-gray-800 mb-2">Import Mode:</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={bulkMode === 'replace'}
                        onChange={() => setBulkMode('replace')}
                        className="text-[#006633] focus:ring-[#006633]"
                      />
                      <span className="font-semibold text-gray-800">
                        Replace all existing offices <span className="text-gray-500 font-normal">(Recommended for clean list)</span>
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={bulkMode === 'append'}
                        onChange={() => setBulkMode('append')}
                        className="text-[#006633] focus:ring-[#006633]"
                      />
                      <span className="font-semibold text-gray-800">Add to existing offices</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg border border-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessBulkImport}
                    disabled={!bulkTextInput.trim()}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs flex items-center space-x-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import {bulkTextInput.split('\n').filter((l) => l.trim()).length} Offices</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-sm p-6 shadow-xl text-xs">
            <div className="flex items-center space-x-3 text-amber-600 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Reset Post Offices</h3>
                <p className="text-[11px] text-gray-500 font-medium">Reset to standard Gujranwala Division directory</p>
              </div>
            </div>

            <p className="text-gray-700 font-medium mb-5 bg-gray-50 p-3 rounded border border-gray-200">
              This will restore the default 30 Gujranwala Division post offices directory.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetDefaultOffices) onResetDefaultOffices();
                  setIsResetModalOpen(false);
                }}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md shadow-xs flex items-center space-x-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-sm p-6 shadow-xl text-xs">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Clear All Post Offices</h3>
                <p className="text-[11px] text-gray-500 font-medium">Remove all registered offices</p>
              </div>
            </div>

            <p className="text-gray-700 font-medium mb-5 bg-red-50 p-3 rounded border border-red-200 text-red-800">
              Are you sure you want to clear all {postOffices.length} offices? You can paste your own fresh list afterwards.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllOffices) onClearAllOffices();
                  setIsClearAllModalOpen(false);
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md shadow-xs flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Office Confirmation Modal */}
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

      {/* Single Add / Edit Modal */}
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
                  placeholder="e.g. Daska GPO"
                  required
                  className="w-full bg-white border border-gray-300 text-gray-900 rounded-md p-2 focus:ring-1 focus:ring-[#006633] focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Postmaster / Incharge Name</label>
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
