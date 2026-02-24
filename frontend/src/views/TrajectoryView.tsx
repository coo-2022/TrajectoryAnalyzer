import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Filter,
  Loader2,
  X,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Pagination } from '../components/Pagination';

// ==========================================
// Type Declarations
// ==========================================

declare global {
  interface Window {
    filterRefs?: Record<string, HTMLDivElement | null>;
  }
}

// ==========================================
// Types
// ==========================================

export interface ColumnFilter {
  field: string;
  type: 'text' | 'number' | 'options';
  active: boolean;
  value: string;
  selected: string[];
  conditions: {
    equals?: number | null;
    greaterThan?: number | null;
    lessThan?: number | null;
  };
}

export interface TrajectoryViewState {
  page: number;
  searchType: string;
  searchTerm: string;
  trajectories: any[];
  total: number;
  isLoaded: boolean;
  trainingId?: string;
  epochId?: number | null;
  iterationId?: number | null;
  sampleId?: number | null;
}

export interface TrajectoryViewProps {
  onSelectTrajectory: (id: string) => void;
  state: TrajectoryViewState;
  setState: React.Dispatch<React.SetStateAction<TrajectoryViewState>>;
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
      const url = new URL(`${baseURL}${endpoint}`);
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== '') {
          url.searchParams.append(key, params[key]);
        }
      });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Fetch failed:", error);
      return null;
    }
  }

  async getTrajectories(page: number = 1, pageSize: number = 20, filters: Record<string, any> = {}) {
    const params = {
      ...filters,
      page,
      pageSize
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
  { id: 'training_id', label: 'Training ID', filterType: 'text', sortable: true, width: 'w-40' },
  { id: 'epoch_id', label: 'Epoch', filterType: 'number', sortable: true, width: 'w-20' },
  { id: 'iteration_id', label: 'Iteration', filterType: 'number', sortable: true, width: 'w-24' },
  { id: 'sample_id', label: 'Sample', filterType: 'number', sortable: true, width: 'w-20' },
  { id: 'questionId', label: 'Question ID', filterType: 'text', sortable: true, width: 'w-40' },
  { id: 'trajectory_id', label: 'Trajectory ID', filterType: 'text', sortable: true, width: 'w-40' },
  { id: 'task.question', label: 'Question', filterType: 'text', sortable: false, width: 'w-auto' },
  { id: 'isSuccess', label: 'Result', filterType: 'options', options: ['Success', 'Failed'], sortable: true, width: 'w-24' },
  { id: 'termination_reason', label: 'Termination Reason', filterType: 'options', options: ['success', 'failed'], sortable: true, width: 'w-36' },
  { id: 'rootCause', label: 'Root Cause', filterType: 'text', sortable: false, width: 'w-48' },
  { id: 'step_count', label: 'Steps', filterType: 'number', sortable: true, width: 'w-20' },
  { id: 'exec_time', label: 'Time', filterType: 'number', sortable: true, width: 'w-24' },
  { id: 'agent_name', label: 'Agent', filterType: 'text', sortable: true, width: 'w-32' },
  { id: 'reward', label: 'Reward', filterType: 'number', sortable: true, width: 'w-24' },
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

// ==========================================
// Main Component
// ==========================================

export const TrajectoryView: React.FC<TrajectoryViewProps> = ({ onSelectTrajectory, state, setState }) => {
  const [loading, setLoading] = useState(false);

  // 列筛选状态 - 当state.isLoaded为false时重置
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>(() => {
    return TABLE_COLUMNS.reduce((acc, col) => ({
      ...acc,
      [col.id]: {
        field: col.id,
        type: col.filterType as any,
        active: false,
        value: '',
        selected: [],
        conditions: {},
      }
    }), {});
  });

  // 排序状态
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 筛选面板显示状态
  const [openFilterPanel, setOpenFilterPanel] = useState<string | null>(null);

  // 当state被重置时，也重置筛选和排序状态
  useEffect(() => {
    if (!state.isLoaded) {
      const resetFilters = TABLE_COLUMNS.reduce((acc, col) => ({
        ...acc,
        [col.id]: {
          field: col.id,
          type: col.filterType as any,
          active: false,
          value: '',
          selected: [],
          conditions: {},
        }
      }), {});
      setColumnFilters(resetFilters);
      setSortField(null);
      setSortOrder('desc');
    }
  }, [state.isLoaded]);

  // 处理筛选面板切换
  useEffect(() => {
    const handleToggleFilter = (event: CustomEvent) => {
      const columnId = event.detail;
      setOpenFilterPanel(openFilterPanel === columnId ? null : columnId);
    };

    window.addEventListener('toggleFilter' as any, handleToggleFilter);

    // 点击外部关闭筛选面板
    const handleClickOutside = (event: MouseEvent) => {
      if (openFilterPanel) {
        const panel = document.getElementById(`filter-panel-${openFilterPanel}`);
        if (panel && !panel.contains(event.target as Node)) {
          const button = (event.target as HTMLElement).closest('button');
          if (!button || !button.onclick?.toString().includes('toggleFilter')) {
            setOpenFilterPanel(null);
          }
        }
      }
    };

    if (openFilterPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('toggleFilter' as any, handleToggleFilter);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openFilterPanel]);

  useEffect(() => {
    if (!state.isLoaded) {
        loadData(state.page);
    }
  }, [state.isLoaded]);

  // 构建API筛选参数
  const buildFilterParams = () => {
    const params: Record<string, any> = {};

    // 处理搜索类型和搜索词（从问题页面跳转）
    // 当从问题页面点击跳转时，只使用 questionId 过滤，不添加其他过滤条件
    if (state.searchType === 'questionId' && state.searchTerm) {
      params.data_id = state.searchTerm;
    } else if (state.searchType === 'trajectoryId' && state.searchTerm) {
      params.trajectory_id = state.searchTerm;
    } else {
      // 非问题跳转场景时，才使用 state-level filters
      if (state.trainingId) {
        params.training_id = state.trainingId;
      }
      if (state.epochId !== undefined && state.epochId !== null) {
        params.epoch_id = state.epochId;
      }
      if (state.iterationId !== undefined && state.iterationId !== null) {
        params.iteration_id = state.iterationId;
      }
      if (state.sampleId !== undefined && state.sampleId !== null) {
        params.sample_id = state.sampleId;
      }
    }

    Object.entries(columnFilters).forEach(([field, filter]) => {
      if (!filter.active) return;

      if (field === 'trajectory_id' && filter.value) {
        params.trajectory_id = filter.value;
      } else if (field === 'questionId' && filter.value) {
        params.data_id = filter.value;
      } else if (field === 'training_id' && filter.value) {
        params.training_id = filter.value;
      } else if (field === 'epoch_id' && filter.conditions) {
        if (filter.conditions.equals !== null && filter.conditions.equals !== undefined) {
          params.epoch_id = filter.conditions.equals;
        }
      } else if (field === 'iteration_id' && filter.conditions) {
        if (filter.conditions.equals !== null && filter.conditions.equals !== undefined) {
          params.iteration_id = filter.conditions.equals;
        }
      } else if (field === 'sample_id' && filter.conditions) {
        if (filter.conditions.equals !== null && filter.conditions.equals !== undefined) {
          params.sample_id = filter.conditions.equals;
        }
      } else if (field === 'task.question' && filter.value) {
        params.question = filter.value;
      } else if (field === 'isSuccess' && filter.selected?.length > 0) {
        if (filter.selected.length === 1) {
          params.is_success = filter.selected.includes('Success') ? 'true' : 'false';
        }
      } else if (field === 'termination_reason' && filter.selected?.length > 0) {
        params.termination_reason = filter.selected.join(',');
      } else if (field === 'rootCause' && filter.value) {
        params.question = filter.value;
      } else if (field === 'agent_name' && filter.value) {
        params.agent_name = filter.value;
      } else if (field === 'reward' && filter.conditions) {
        if (filter.conditions.equals !== null && filter.conditions.equals !== undefined) {
          params.reward_exact = filter.conditions.equals;
        } else {
          if (filter.conditions.greaterThan !== null && filter.conditions.greaterThan !== undefined) {
            params.reward_min = filter.conditions.greaterThan;
          }
          if (filter.conditions.lessThan !== null && filter.conditions.lessThan !== undefined) {
            params.reward_max = filter.conditions.lessThan;
          }
        }
      } else if (field === 'step_count' && filter.conditions) {
        if (filter.conditions.greaterThan !== null && filter.conditions.greaterThan !== undefined) {
          params.step_count_min = filter.conditions.greaterThan;
        }
        if (filter.conditions.lessThan !== null && filter.conditions.lessThan !== undefined) {
          params.step_count_max = filter.conditions.lessThan;
        }
      } else if (field === 'exec_time' && filter.conditions) {
        if (filter.conditions.greaterThan !== null && filter.conditions.greaterThan !== undefined) {
          params.exec_time_min = filter.conditions.greaterThan;
        }
        if (filter.conditions.lessThan !== null && filter.conditions.lessThan !== undefined) {
          params.exec_time_max = filter.conditions.lessThan;
        }
      }
    });

    return params;
  };

  const loadData = async (page: number) => {
    setLoading(true);

    try {
      const filterParams = buildFilterParams();

      const params = {
        page,
        pageSize: 15,
        ...filterParams,
        ...(sortField && { sortBy: sortField, sort_order: sortOrder })
      };

      console.log('Loading trajectories with params:', params);

      const res = await backend.getTrajectories(page, 15, params);

      console.log('API response:', res);

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
  };

  const handleFilterApply = (field: string) => {
    setColumnFilters(prev => {
      const updated = {
        ...prev,
        [field]: { ...prev[field], active: true }
      };
      const params = buildFilterParamsFromFilters(updated);
      setTimeout(() => loadDataWithParams(1, params), 0);
      return updated;
    });
  };

  const buildFilterParamsFromFilters = (filters: Record<string, ColumnFilter>) => {
    const params: Record<string, any> = {};

    Object.entries(filters).forEach(([fieldId, filter]) => {
      if (!filter.active) return;

      const field = fieldId;
      if (field === 'trajectory_id' && filter.value) {
        params.trajectory_id = filter.value;
      } else if (field === 'questionId' && filter.value) {
        params.data_id = filter.value;
      } else if (field === 'task.question' && filter.value) {
        params.question = filter.value;
      } else if (field === 'isSuccess' && filter.selected?.length > 0) {
        if (filter.selected.length === 1) {
          params.is_success = filter.selected.includes('Success') ? 'true' : 'false';
        }
      } else if (field === 'termination_reason' && filter.selected?.length > 0) {
        params.termination_reason = filter.selected.join(',');
      } else if (field === 'rootCause' && filter.value) {
        params.question = filter.value;
      } else if (field === 'agent_name' && filter.value) {
        params.agent_name = filter.value;
      } else if (field === 'reward' && filter.conditions) {
        if (filter.conditions.equals !== null && filter.conditions.equals !== undefined) {
          params.reward_exact = filter.conditions.equals;
        } else {
          if (filter.conditions.greaterThan !== null && filter.conditions.greaterThan !== undefined) {
            params.reward_min = filter.conditions.greaterThan;
          }
          if (filter.conditions.lessThan !== null && filter.conditions.lessThan !== undefined) {
            params.reward_max = filter.conditions.lessThan;
          }
        }
      } else if (field === 'step_count' && filter.conditions) {
        if (filter.conditions.greaterThan !== null && filter.conditions.greaterThan !== undefined) {
          params.step_count_min = filter.conditions.greaterThan;
        }
        if (filter.conditions.lessThan !== null && filter.conditions.lessThan !== undefined) {
          params.step_count_max = filter.conditions.lessThan;
        }
      } else if (field === 'exec_time' && filter.conditions) {
        if (filter.conditions.greaterThan !== null && filter.conditions.greaterThan !== undefined) {
          params.exec_time_min = filter.conditions.greaterThan;
        }
        if (filter.conditions.lessThan !== null && filter.conditions.lessThan !== undefined) {
          params.exec_time_max = filter.conditions.lessThan;
        }
      }
    });

    return params;
  };

  const loadDataWithParams = async (page: number, filterParams: Record<string, any>) => {
    setLoading(true);

    try {
      const params = {
        page,
        pageSize: 15,
        ...filterParams,
        ...(sortField && { sortBy: sortField, sort_order: sortOrder })
      };

      console.log('Loading trajectories with params:', params);

      const res = await backend.getTrajectories(page, 15, params);

      console.log('API response:', res);

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
  };

  const handleFilterClear = (field: string) => {
    setColumnFilters(prev => {
      const updated = {
        ...prev,
        [field]: {
          ...prev[field],
          active: false,
          value: '',
          selected: [],
          conditions: {},
        }
      };
      const params = buildFilterParamsFromFilters(updated);
      setTimeout(() => loadDataWithParams(1, params), 0);
      return updated;
    });
  };

  const handleClearAllFilters = () => {
    const resetFilters = Object.keys(columnFilters).reduce((acc, key) => ({
      ...acc,
      [key]: {
        ...columnFilters[key],
        active: false,
        value: '',
        selected: [],
        conditions: {},
      }
    }), {});

    setColumnFilters(resetFilters);
    setSortField(null);
    setSortOrder('desc');
    setTimeout(() => loadDataWithParams(1, {}), 0);
  };

  const handleSort = (field: string) => {
    let newSortField: string;
    let newSortOrder: 'asc' | 'desc';

    if (sortField === field) {
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      newSortField = field;
    } else {
      newSortField = field;
      newSortOrder = 'desc';
    }

    setSortField(newSortField);
    setSortOrder(newSortOrder);

    const params = buildFilterParamsFromFilters(columnFilters);
    setTimeout(() => {
      const sortParams = {
        ...params,
        sortBy: newSortField,
        sort_order: newSortOrder
      };
      loadDataWithParams(1, sortParams);
    }, 0);
  };

  const activeFilterCount = Object.values(columnFilters).filter(f => f.active).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 flex items-center">
              <LayoutDashboard size={18} className="mr-2 text-slate-500"/>
              Trajectory List
            </h3>

            {(activeFilterCount > 0 || sortField) && (
              <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                {sortField && ` • Sorted by ${sortField}`}
              </span>
            )}
          </div>

          {(activeFilterCount > 0 || sortField) && (
            <button
              onClick={handleClearAllFilters}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear All
            </button>
          )}

          <div className="h-6 w-px bg-slate-300 mx-2 hidden md:block"></div>

          <span className="text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-slate-500 font-mono whitespace-nowrap">
            Total: {state.total}
          </span>
        </div>

        {/* Table Content */}
        <div className="relative overflow-x-auto min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
                    <span className="text-sm text-slate-500 font-medium">Updating...</span>
                </div>
            </div>
          )}

          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {TABLE_COLUMNS.map((col) => {
                  const filter = columnFilters[col.id] || {};
                  return (
                    <th key={col.id} className={`px-6 py-3 text-left ${col.width || ''}`}>
                      <div className="flex items-center gap-2">
                        {col.sortable ? (
                          <button
                            onClick={() => handleSort(col.id)}
                            className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
                          >
                            {col.label}
                            {sortField === col.id && (
                              <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                            {sortField !== col.id && <span className="text-slate-300">↕</span>}
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-slate-600">{col.label}</span>
                        )}

                        <div className="relative inline-block" ref={(el) => {
                          if (!window.filterRefs) window.filterRefs = {};
                          window.filterRefs[col.id] = el;
                        }}>
                          <button
                            onClick={() => {
                              const event = new CustomEvent('toggleFilter', { detail: col.id });
                              window.dispatchEvent(event);
                            }}
                            className={`p-1 rounded transition-colors ${
                              filter.active
                                ? 'bg-blue-100 text-blue-600'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                            title={filter.active ? 'Filter active' : 'Filter'}
                          >
                            <Filter size={14} />
                          </button>

                          <div id={`filter-panel-${col.id}`} className={openFilterPanel === col.id ? '' : 'hidden'}>
                            {col.filterType === 'text' && (
                              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 p-3 min-w-[250px]">
                                <input
                                  type="text"
                                  placeholder={`Search ${col.label}...`}
                                  value={filter.value || ''}
                                  onChange={(e) => {
                                    setColumnFilters(prev => ({
                                      ...prev,
                                      [col.id]: { ...prev[col.id], value: e.target.value }
                                    }));
                                  }}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => handleFilterApply(col.id)}
                                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => handleFilterClear(col.id)}
                                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            )}

                            {col.filterType === 'options' && col.options && (
                              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 p-3 min-w-[200px] max-h-[300px] overflow-y-auto">
                                {col.options.map(option => (
                                  <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={filter.selected?.includes(option) || false}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...(filter.selected || []), option]
                                          : (filter.selected || []).filter(s => s !== option);
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          [col.id]: { ...prev[col.id], selected: newSelected }
                                        }));
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm">{option}</span>
                                  </label>
                                ))}
                                <div className="flex gap-2 mt-3 border-t pt-3">
                                  <button
                                    onClick={() => handleFilterApply(col.id)}
                                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => handleFilterClear(col.id)}
                                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            )}

                            {col.filterType === 'number' && (
                              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 p-3 min-w-[250px] space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={filter.conditions?.equals !== null && filter.conditions?.equals !== undefined}
                                    onChange={(e) => {
                                      setColumnFilters(prev => ({
                                        ...prev,
                                        [col.id]: {
                                          ...prev[col.id],
                                          conditions: { ...prev[col.id].conditions, equals: e.target.checked ? 0 : null }
                                        }
                                      }));
                                    }}
                                    className="rounded"
                                  />
                                  <span>Equals:</span>
                                  {filter.conditions?.equals !== null && filter.conditions?.equals !== undefined && (
                                    <input
                                      type="number"
                                      value={filter.conditions.equals ?? ''}
                                      onChange={(e) => {
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          [col.id]: {
                                            ...prev[col.id],
                                            conditions: { ...prev[col.id].conditions, equals: parseFloat(e.target.value) || 0 }
                                          }
                                        }));
                                      }}
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                                    />
                                  )}
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={filter.conditions?.greaterThan !== null && filter.conditions?.greaterThan !== undefined}
                                    onChange={(e) => {
                                      setColumnFilters(prev => ({
                                        ...prev,
                                        [col.id]: {
                                          ...prev[col.id],
                                          conditions: { ...prev[col.id].conditions, greaterThan: e.target.checked ? 0 : null }
                                        }
                                      }));
                                    }}
                                    className="rounded"
                                  />
                                  <span>Min:</span>
                                  {filter.conditions?.greaterThan !== null && filter.conditions?.greaterThan !== undefined && (
                                    <input
                                      type="number"
                                      value={filter.conditions.greaterThan ?? ''}
                                      onChange={(e) => {
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          [col.id]: {
                                            ...prev[col.id],
                                            conditions: { ...prev[col.id].conditions, greaterThan: parseFloat(e.target.value) || 0 }
                                          }
                                        }));
                                      }}
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                                    />
                                  )}
                                </label>

                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={filter.conditions?.lessThan !== null && filter.conditions?.lessThan !== undefined}
                                    onChange={(e) => {
                                      setColumnFilters(prev => ({
                                        ...prev,
                                        [col.id]: {
                                          ...prev[col.id],
                                          conditions: { ...prev[col.id].conditions, lessThan: e.target.checked ? 0 : null }
                                        }
                                      }));
                                    }}
                                    className="rounded"
                                  />
                                  <span>Max:</span>
                                  {filter.conditions?.lessThan !== null && filter.conditions?.lessThan !== undefined && (
                                    <input
                                      type="number"
                                      value={filter.conditions.lessThan ?? ''}
                                      onChange={(e) => {
                                        setColumnFilters(prev => ({
                                          ...prev,
                                          [col.id]: {
                                            ...prev[col.id],
                                            conditions: { ...prev[col.id].conditions, lessThan: parseFloat(e.target.value) || 0 }
                                          }
                                        }));
                                      }}
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                                    />
                                  )}
                                </label>

                                <div className="flex gap-2 mt-3 pt-2 border-t">
                                  <button
                                    onClick={() => handleFilterApply(col.id)}
                                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => handleFilterClear(col.id)}
                                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {filter.active && (
                            <button
                              onClick={() => handleFilterClear(col.id)}
                              className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Clear filter"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!state.isLoaded && loading ? (
                 <tr><td colSpan={14} className="p-10 text-center text-slate-500">Initializing...</td></tr>
              ) : (state.trajectories || []).map((t) => (
                <tr key={t.trajectory_id} onClick={() => onSelectTrajectory(t.trajectory_id)} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">{t.training_id || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{t.epoch_id ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{t.iteration_id ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{t.sample_id ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">{t.questionId || t.data_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500 group-hover:text-blue-600 font-medium">
                    {t.trajectory_id}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-800"><div className="max-w-md truncate">{t.task?.question || t.question}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><ResultBadge success={t.isSuccess} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    <span className={`px-2 py-1 rounded text-xs ${
                      t.termination_reason === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {t.termination_reason || "-"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      <div className="max-w-xs truncate" title={t.rootCause}>
                         {t.isSuccess ? "-" : (t.rootCause || "-")}
                      </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{t.step_count || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{(t.exec_time || 0).toFixed(2)}s</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                    <span className="border border-slate-100 rounded bg-slate-50 px-2 py-0.5">{t.agent_name || "-"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{t.reward !== undefined ? t.reward.toFixed(1) : '-'}</td>
                </tr>
              ))}

              {state.isLoaded && (state.trajectories || []).length === 0 && (
                  <tr><td colSpan={14} className="p-10 text-center text-slate-400">No results found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination current={state.page} total={state.total} pageSize={15} onChange={(p: number) => loadData(p)} />
      </div>
    </div>
  );
};
