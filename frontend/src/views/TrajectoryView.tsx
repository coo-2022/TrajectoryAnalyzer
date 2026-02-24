import React, { useState, useEffect, useCallback } from 'react';
import {
  Filter,
  Loader2,
  X,
  CheckCircle,
  XCircle,
  Search,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
import { Pagination } from '../components/Pagination';

// ==========================================
// Types
// ==========================================

export interface TrajectoryViewState {
  page: number;
  searchType: string;
  searchTerm: string;
  trajectories: any[];
  total: number;
  isLoaded: boolean;
  // 过滤条件状态
  filters?: Record<string, any>;
  numberFilters?: Record<string, { min?: number; max?: number }>;
  sortField?: string | null;
  sortOrder?: 'asc' | 'desc';
  searchInput?: string;
  showFilterPanel?: boolean;
}

export interface TrajectoryViewProps {
  onSelectTrajectory: (id: string) => void;
  state: TrajectoryViewState;
  setState: React.Dispatch<React.SetStateAction<TrajectoryViewState>>;
}

interface FilterConfig {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  placeholder?: string;
  options?: { value: string; label: string }[];
}

// ==========================================
// API Backend
// ==========================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const API_ROOT = import.meta.env.VITE_API_ROOT_URL || "http://localhost:8000";

class APIBackend {
  async fetchJSON(endpoint: string, params: Record<string, any> = {}, useAPIBase: boolean = true) {
    try {
      const baseURL = useAPIBase ? API_BASE : API_ROOT;
      const urlString = baseURL ? `${baseURL}${endpoint}` : endpoint;
      const url = new URL(urlString, window.location.origin);
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== '' && params[key] !== null) {
          url.searchParams.append(key, params[key]);
        }
      });

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Fetch failed:", error);
      return null;
    }
  }

  async getTrajectories(page: number = 1, pageSize: number = 20, filters: Record<string, any> = {}, sortBy?: string, sortOrder?: string) {
    const params = {
      ...filters,
      page,
      pageSize,
      ...(sortBy && { sortBy, sort_order: sortOrder })
    };

    const data = await this.fetchJSON('/trajectories', params);
    return data || { data: [], total: 0, page, pageSize };
  }
}

const backend = new APIBackend();

// ==========================================
// Constants
// ==========================================

const TABLE_COLUMNS = [
  { id: 'training_id', label: 'Training ID', sortable: true, width: 'w-40' },
  { id: 'epoch_id', label: 'Epoch', sortable: true, width: 'w-20' },
  { id: 'iteration_id', label: 'Iteration', sortable: true, width: 'w-24' },
  { id: 'sample_id', label: 'Sample', sortable: true, width: 'w-20' },
  { id: 'questionId', label: 'Question ID', sortable: true, width: 'w-40' },
  { id: 'trajectory_id', label: 'Trajectory ID', sortable: true, width: 'w-40' },
  { id: 'task.question', label: 'Question', sortable: false, width: 'w-auto' },
  { id: 'isSuccess', label: 'Result', sortable: true, width: 'w-24' },
  { id: 'termination_reason', label: 'Termination', sortable: true, width: 'w-28' },
  { id: 'rootCause', label: 'Root Cause', sortable: false, width: 'w-48' },
  { id: 'step_count', label: 'Steps', sortable: true, width: 'w-20' },
  { id: 'exec_time', label: 'Time', sortable: true, width: 'w-24' },
  { id: 'agent_name', label: 'Agent', sortable: true, width: 'w-32' },
  { id: 'reward', label: 'Reward', sortable: true, width: 'w-24' },
];

const FILTER_CONFIGS: FilterConfig[] = [
  { id: 'trajectory_id', label: 'Trajectory ID', type: 'text', placeholder: 'Search trajectory ID...' },
  { id: 'data_id', label: 'Question ID', type: 'text', placeholder: 'Search question ID...' },
  { id: 'question', label: 'Question Text', type: 'text', placeholder: 'Search question content...' },
  { id: 'training_id', label: 'Training ID', type: 'text', placeholder: 'Search training ID...' },
  { id: 'agent_name', label: 'Agent', type: 'text', placeholder: 'Search agent name...' },
  { id: 'termination_reason', label: 'Termination', type: 'select', options: [
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
  ]},
  { id: 'is_success', label: 'Result', type: 'select', options: [
    { value: 'true', label: 'Success' },
    { value: 'false', label: 'Failed' },
  ]},
];

// ==========================================
// Helper Components
// ==========================================

export const ResultBadge: React.FC<{ success: boolean }> = ({ success }) => (
  success ?
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
    <CheckCircle size={12} className="mr-1"/> Success
  </span> :
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
    <XCircle size={12} className="mr-1"/> Fail
  </span>
);

// 防抖 Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ==========================================
// Main Component
// ==========================================

export const TrajectoryView: React.FC<TrajectoryViewProps> = ({ onSelectTrajectory, state, setState }) => {
  const [loading, setLoading] = useState(false);
  // 从 state 中恢复排序状态，默认为 null 和 'desc'
  const [sortField, setSortField] = useState<string | null>(state.sortField ?? null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(state.sortOrder ?? 'desc');

  // 过滤状态 - 从 state 中恢复
  const [filters, setFilters] = useState<Record<string, any>>(state.filters ?? {});
  const [numberFilters, setNumberFilters] = useState<Record<string, { min?: number; max?: number }>>(state.numberFilters ?? {});
  const [showFilterPanel, setShowFilterPanel] = useState(state.showFilterPanel ?? false);
  const [searchInput, setSearchInput] = useState(state.searchInput ?? '');

  // 防抖的搜索输入
  const debouncedSearch = useDebounce(searchInput, 300);

  // 当过滤条件变化时，同步到父组件 state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      filters,
      numberFilters,
      sortField,
      sortOrder,
      searchInput,
      showFilterPanel
    }));
  }, [filters, numberFilters, sortField, sortOrder, searchInput, showFilterPanel]);

  // 加载数据
  const loadData = useCallback(async (page: number, currentFilters: Record<string, any> = {}, currentSortField?: string, currentSortOrder?: string) => {
    setLoading(true);
    try {
      // 构建过滤参数
      const filterParams: Record<string, any> = {};

      // 处理从问题页面跳转的搜索
      if (state.searchType === 'questionId' && state.searchTerm) {
        filterParams.data_id = state.searchTerm;
      } else if (state.searchType === 'trajectoryId' && state.searchTerm) {
        filterParams.trajectory_id = state.searchTerm;
      }

      // 添加普通过滤条件
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) {
          filterParams[key] = value;
        }
      });

      // 添加数字范围过滤
      Object.entries(numberFilters).forEach(([key, range]) => {
        if (range.min !== undefined && !isNaN(range.min)) {
          filterParams[`${key}_min`] = range.min;
        }
        if (range.max !== undefined && !isNaN(range.max)) {
          filterParams[`${key}_max`] = range.max;
        }
      });

      // 添加全局搜索（搜索 trajectory_id 和 question）
      if (debouncedSearch) {
        filterParams.search = debouncedSearch;
      }

      console.log('Loading trajectories with params:', { page, filters: filterParams, sortBy: currentSortField, sortOrder: currentSortOrder });

      const res = await backend.getTrajectories(page, 15, filterParams, currentSortField, currentSortOrder);

      if (!res) {
        console.error('API returned null response');
        setState(prev => ({
          ...prev,
          trajectories: [],
          total: 0,
          page: page,
          isLoaded: true
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        trajectories: res.data || [],
        total: res.total || 0,
        page: page,
        isLoaded: true
      }));
    } catch (error) {
      console.error('Error loading trajectories:', error);
      setState(prev => ({
        ...prev,
        trajectories: [],
        total: 0,
        page: page,
        isLoaded: true
      }));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, numberFilters, setState, state.searchTerm, state.searchType]);

  // 初始加载和过滤/排序变化时触发
  useEffect(() => {
    if (!state.isLoaded) {
      loadData(1, filters, sortField || undefined, sortOrder);
    }
  }, [state.isLoaded]);

  // 搜索输入、过滤或排序变化时重新加载
  useEffect(() => {
    if (state.isLoaded) {
      loadData(1, filters, sortField || undefined, sortOrder);
    }
  }, [debouncedSearch, filters, numberFilters, sortField, sortOrder]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value === '' || value === undefined || value === null) {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }
      return newFilters;
    });
  };

  const handleNumberFilterChange = (key: string, field: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setNumberFilters(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: numValue
      }
    }));
  };

  const clearAllFilters = () => {
    setFilters({});
    setNumberFilters({});
    setSearchInput('');
    setSortField(null);
    setSortOrder('desc');
  };

  const removeFilter = (key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const removeNumberFilter = (key: string) => {
    setNumberFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  // 计算激活的过滤数量
  const activeFilterCount = Object.keys(filters).length +
    Object.values(numberFilters).filter(v => v?.min !== undefined || v?.max !== undefined).length +
    (debouncedSearch ? 1 : 0);

  // 检查是否有从问题页面跳转的过滤
  const hasJumpFilter = state.searchType === 'questionId' && state.searchTerm;

  return (
    <div className="space-y-4">
      {/* Header with Search and Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col gap-4">
          {/* Top Row: Search and Main Controls */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search trajectories..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showFilterPanel || activeFilterCount > 0
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                <SlidersHorizontal size={18} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {(activeFilterCount > 0 || sortField) && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <RotateCcw size={16} />
                  Reset
                </button>
              )}

              <span className="text-sm text-slate-500">
                Total: <span className="font-medium text-slate-700">{state.total}</span>
              </span>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 mr-1">Active filters:</span>

              {/* Search filter tag */}
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                  Search: {debouncedSearch}
                  <button onClick={() => setSearchInput('')} className="hover:text-blue-900">
                    <X size={12} />
                  </button>
                </span>
              )}

              {/* Regular filters */}
              {Object.entries(filters).map(([key, value]) => {
                const config = FILTER_CONFIGS.find(f => f.id === key);
                const label = config?.label || key;
                const displayValue = config?.options?.find(o => o.value === value)?.label || value;
                return (
                  <span key={key} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200">
                    {label}: {displayValue}
                    <button onClick={() => removeFilter(key)} className="hover:text-slate-900">
                      <X size={12} />
                    </button>
                  </span>
                );
              })}

              {/* Number range filters */}
              {Object.entries(numberFilters).map(([key, range]) => {
                if (!range || (range.min === undefined && range.max === undefined)) return null;
                const column = TABLE_COLUMNS.find(c => c.id === key);
                const label = column?.label || key;
                const minText = range.min !== undefined ? `≥${range.min}` : '';
                const maxText = range.max !== undefined ? `≤${range.max}` : '';
                const rangeText = minText && maxText ? `${minText} ${maxText}` : minText || maxText;
                return (
                  <span key={key} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200">
                    {label}: {rangeText}
                    <button onClick={() => removeNumberFilter(key)} className="hover:text-slate-900">
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Jump Filter Notice */}
          {hasJumpFilter && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Filter size={16} className="text-amber-600" />
              <span className="text-sm text-amber-800">
                Filtered by Question ID: <strong>{state.searchTerm}</strong>
              </span>
              <button
                onClick={() => setState(prev => ({ ...prev, searchType: 'id', searchTerm: '' }))}
                className="ml-auto text-xs text-amber-700 hover:text-amber-900 underline"
              >
                Clear
              </button>
            </div>
          )}

          {/* Filter Panel */}
          {showFilterPanel && (
            <div className="pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Text and Select Filters */}
                {FILTER_CONFIGS.map(config => (
                  <div key={config.id} className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">{config.label}</label>
                    {config.type === 'select' ? (
                      <select
                        value={filters[config.id] || ''}
                        onChange={(e) => handleFilterChange(config.id, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All</option>
                        {config.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder={config.placeholder}
                        value={filters[config.id] || ''}
                        onChange={(e) => handleFilterChange(config.id, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}

                {/* Exact Value Filters (Epoch, Iteration, Sample) */}
                {[
                  { id: 'epoch_id', label: 'Epoch' },
                  { id: 'iteration_id', label: 'Iteration' },
                  { id: 'sample_id', label: 'Sample' },
                ].map(({ id, label }) => (
                  <div key={id} className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">{label}</label>
                    <input
                      type="number"
                      placeholder={`Enter ${label.toLowerCase()}...`}
                      value={filters[id] || ''}
                      onChange={(e) => handleFilterChange(id, e.target.value ? parseInt(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ))}

                {/* Number Range Filters (Reward only) */}
                <div key="reward" className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Reward Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={numberFilters['reward']?.min ?? ''}
                      onChange={(e) => handleNumberFilterChange('reward', 'min', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-slate-400">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={numberFilters['reward']?.max ?? ''}
                      onChange={(e) => handleNumberFilterChange('reward', 'max', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="relative overflow-x-auto min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
                <span className="text-sm text-slate-500 font-medium">Loading...</span>
              </div>
            </div>
          )}

          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col.id} className={`px-4 py-3 text-left ${col.width || ''}`}>
                    <button
                      onClick={() => col.sortable && handleSort(col.id)}
                      disabled={!col.sortable}
                      className={`flex items-center gap-1 text-xs font-medium ${
                        col.sortable
                          ? 'text-slate-600 hover:text-blue-600 cursor-pointer'
                          : 'text-slate-500 cursor-default'
                      }`}
                    >
                      {col.label}
                      {col.sortable && (
                        <span className="text-slate-400">
                          {sortField === col.id
                            ? (sortOrder === 'asc' ? '↑' : '↓')
                            : '↕'}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!state.isLoaded && loading ? (
                <tr><td colSpan={14} className="p-10 text-center text-slate-500">Initializing...</td></tr>
              ) : (state.trajectories || []).map((t) => (
                <tr
                  key={t.trajectory_id}
                  onClick={() => onSelectTrajectory(t.trajectory_id)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-slate-500">{t.training_id || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono">{t.epoch_id ?? '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono">{t.iteration_id ?? '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono">{t.sample_id ?? '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-slate-500">{t.questionId || t.data_id}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-slate-500 group-hover:text-blue-600 font-medium">
                    {t.trajectory_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-800">
                    <div className="max-w-md truncate">{t.task?.question || t.question}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><ResultBadge success={t.isSuccess} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                    <span className={`px-2 py-1 rounded text-xs ${
                      t.termination_reason === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {t.termination_reason || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                    <div className="max-w-xs truncate" title={t.rootCause}>
                      {t.isSuccess ? "-" : (t.rootCause || "-")}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono">{t.step_count || 0}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono">{(t.exec_time || 0).toFixed(2)}s</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                    <span className="border border-slate-100 rounded bg-slate-50 px-2 py-0.5">{t.agent_name || "-"}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono">
                    {t.reward !== undefined ? t.reward.toFixed(1) : '-'}
                  </td>
                </tr>
              ))}

              {state.isLoaded && (state.trajectories || []).length === 0 && (
                <tr>
                  <td colSpan={14} className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-slate-300" />
                      <p>No trajectories found.</p>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={clearAllFilters}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Clear filters to see all results
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          current={state.page}
          total={state.total}
          pageSize={15}
          onChange={(p: number) => loadData(p, filters, sortField || undefined, sortOrder)}
        />
      </div>
    </div>
  );
};
