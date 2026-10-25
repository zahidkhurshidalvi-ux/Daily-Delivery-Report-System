import React, { useState } from 'react';
import { ArticleCategoryConfig } from '../types';
import { DEFAULT_ARTICLE_CATEGORIES } from '../data/initialData';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sliders,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  Info,
  Check,
  Save,
  X,
  FileSpreadsheet,
} from 'lucide-react';

interface ReportFieldsManagerProps {
  categories: ArticleCategoryConfig[];
  onSaveCategories: (categories: ArticleCategoryConfig[]) => Promise<void> | void;
  onLogAction?: (action: string, details: string, type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR') => void;
}

export const ReportFieldsManager: React.FC<ReportFieldsManagerProps> = ({
  categories,
  onSaveCategories,
  onLogAction,
}) => {
  const [editingCategory, setEditingCategory] = useState<ArticleCategoryConfig | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [requiresEmtts, setRequiresEmtts] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setLabel('');
    setCode('');
    setDescription('');
    setRequiresEmtts(true);
    setEnabled(true);
    setErrorMsg(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (cat: ArticleCategoryConfig) => {
    setEditingCategory(cat);
    setLabel(cat.label);
    setCode(cat.code || '');
    setDescription(cat.description || '');
    setRequiresEmtts(Boolean(cat.requiresEmtts));
    setEnabled(cat.enabled);
    setErrorMsg(null);
    setIsAddModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setErrorMsg('Category name/label is required.');
      return;
    }

    const key = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);

    let updatedList: ArticleCategoryConfig[];

    if (editingCategory) {
      updatedList = categories.map((c) =>
        c.id === editingCategory.id
          ? {
              ...c,
              label: cleanLabel,
              code: code.trim().toUpperCase() || c.code,
              description: description.trim(),
              requiresEmtts,
              enabled,
            }
          : c
      );
    } else {
      const newCat: ArticleCategoryConfig = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        key: `${key}_${Date.now().toString(36).substr(2, 4)}`,
        label: cleanLabel,
        code: code.trim().toUpperCase() || cleanLabel.slice(0, 5).toUpperCase(),
        description: description.trim(),
        requiresEmtts,
        enabled,
        sortOrder: categories.length + 1,
        isSystemDefault: false,
      };
      updatedList = [...categories, newCat];
    }

    try {
      await onSaveCategories(updatedList);
      setSuccessMsg(
        editingCategory
          ? `Category "${cleanLabel}" updated successfully!`
          : `New field "${cleanLabel}" created! It is now active on the User Submission form.`
      );
      setIsAddModalOpen(false);
      if (onLogAction) {
        onLogAction(
          'UPDATE_REPORT_FIELDS',
          `Admin updated report categories: ${cleanLabel}`,
          'SUCCESS'
        );
      }
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg('Failed to save to cloud: ' + (err.message || 'Error'));
    }
  };

  const handleToggleStatus = async (catId: string) => {
    const updatedList = categories.map((c) =>
      c.id === catId ? { ...c, enabled: !c.enabled } : c
    );
    await onSaveCategories(updatedList);
  };

  const handleDelete = async (catId: string) => {
    const target = categories.find((c) => c.id === catId);
    if (!target) return;
    if (confirm(`Are you sure you want to delete the category "${target.label}"?`)) {
      const updatedList = categories.filter((c) => c.id !== catId);
      await onSaveCategories(updatedList);
      if (onLogAction) {
        onLogAction('DELETE_REPORT_FIELD', `Deleted category ${target.label}`, 'WARNING');
      }
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newList = [...categories];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    // re-assign sort order
    const reordered = newList.map((c, idx) => ({ ...c, sortOrder: idx + 1 }));
    await onSaveCategories(reordered);
  };

  const handleResetDefaults = async () => {
    if (
      confirm(
        'Reset all article fields to standard Pakistan Post defaults (RGL, Parcel, UMS, Ordinary, Excise, VPP/VPL, Money Order, E-Challan, COD)?'
      )
    ) {
      await onSaveCategories(DEFAULT_ARTICLE_CATEGORIES);
      setSuccessMsg('Article categories reset to standard official defaults.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const activeCount = categories.filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#00401A] text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Admin Configuration
            </span>
            <span className="text-gray-600 text-xs font-mono font-bold bg-gray-100 px-2 py-0.5 rounded">
              {activeCount} Active / {categories.length} Total Fields
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-1 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#006633]" />
            <span>Report Fields & Categories Manager</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            (رپورٹ فیلڈز اور کیٹیگریز مینجمنٹ) — یہاں سے فیلڈز شامل، ایڈٹ یا غیر فعال کریں، وہ فوراً یوزر فارم پر نظر آئیں گی اور کلاؤڈ ڈیٹا بیس میں محفوظ ہوں گی۔
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleResetDefaults}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs px-3 py-2 rounded-lg border border-gray-300 transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Reset to Pakistan Post 9 standard categories"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Official Defaults</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="bg-[#006633] hover:bg-[#004d26] text-white font-bold text-xs px-3 py-2 rounded-lg shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Category / Field</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3.5 rounded-lg text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-green-700" />
          </button>
        </div>
      )}

      {/* Categories Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#006633]" />
            <h3 className="font-bold text-sm text-gray-800">
              Configured Article Categories (وصول و ترسیل ڈاک کیٹیگریز)
            </h3>
          </div>
          <span className="text-[11px] text-gray-500">
            Form Steps 1 & 2 will automatically render these fields
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[11px] border-b border-gray-200">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Category Name / Field Label</th>
                <th className="p-3 w-28">Code</th>
                <th className="p-3">Description & Type</th>
                <th className="p-3 w-36 text-center">EMTTS Trackable</th>
                <th className="p-3 w-28 text-center">Status</th>
                <th className="p-3 w-36 text-center">Reorder</th>
                <th className="p-3 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {categories.map((cat, idx) => (
                <tr
                  key={cat.id || cat.key}
                  className={`hover:bg-gray-50 transition-colors ${
                    !cat.enabled ? 'opacity-60 bg-gray-50/50' : ''
                  }`}
                >
                  <td className="p-3 text-center font-mono font-bold text-gray-500">
                    {idx + 1}
                  </td>
                  <td className="p-3 font-extrabold text-gray-900">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{cat.label}</span>
                      {cat.isSystemDefault && (
                        <span className="text-[9px] bg-green-100 text-[#006633] px-1.5 py-0.5 rounded font-bold uppercase">
                          Standard
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-mono font-bold text-[#006633]">
                    {cat.code || cat.key.toUpperCase()}
                  </td>
                  <td className="p-3 text-gray-600">
                    {cat.description || 'Postal articles for daily delivery & receipt monitoring.'}
                  </td>
                  <td className="p-3 text-center">
                    {cat.requiresEmtts ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Barcode / Track</span>
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                        Ordinary (No Barcode)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(cat.id)}
                      className={`px-2.5 py-1 rounded text-[10px] font-extrabold transition-colors cursor-pointer ${
                        cat.enabled
                          ? 'bg-green-100 text-[#006633] hover:bg-green-200'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {cat.enabled ? 'ACTIVE' : 'DISABLED'}
                    </button>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === categories.length - 1}
                        className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="p-1.5 bg-gray-100 hover:bg-amber-100 text-amber-800 rounded border border-gray-200 transition-colors cursor-pointer"
                        title="Edit Field"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!cat.isSystemDefault && (
                        <button
                          onClick={() => handleDelete(cat.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-200 transition-colors cursor-pointer"
                          title="Delete Field"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden animate-in fade-in duration-200">
            <div className="bg-[#00401A] text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-yellow-400" />
                <h3 className="font-extrabold text-base">
                  {editingCategory ? 'Edit Article Field' : 'Create New Article Category'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">
                  Field / Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Passport Express, Utility Bills, COD, etc."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#006633]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Short Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UMS, PSPT, COD"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#006633]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    EMTTS Barcode Tracking
                  </label>
                  <select
                    value={requiresEmtts ? 'YES' : 'NO'}
                    onChange={(e) => setRequiresEmtts(e.target.value === 'YES')}
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#006633]"
                  >
                    <option value="YES">Yes (Trackable on EMTTS)</option>
                    <option value="NO">No (Ordinary / Unregistered)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-gray-700 mb-1">
                  Description / Remarks
                </label>
                <input
                  type="text"
                  placeholder="Optional brief description for users"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#006633]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="enable_cat"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded text-[#006633] focus:ring-[#006633] w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor="enable_cat"
                  className="text-xs font-extrabold text-gray-800 cursor-pointer"
                >
                  Enable immediately in User Daily Report Submission Form
                </label>
              </div>

              <div className="pt-4 border-t border-gray-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#006633] hover:bg-[#004d26] text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Field & Sync Cloud</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
