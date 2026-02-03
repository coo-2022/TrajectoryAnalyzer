import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  AlertOctagon,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Activity,
  BarChart2,
  HelpCircle,
  Filter,
  ArrowLeft,
  Clock,
  Cpu,
  Target,
  Terminal,
  User,
  Bot,
  Box,
  ListFilter,
  Loader2,
  ExternalLink,
  X,
  Upload
} from 'lucide-react';
import AnalysisView from './views/AnalysisView';
import ImportView from './views/ImportView';

// ==========================================
// 1. API Backend (Real Data)
// ==========================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const API_ROOT = import.meta.env.VITE_API_ROOT_URL || "http://localhost:8000";

class APIBackend {
  async fetchJSON(endpoint, params = {}, useAPIBase = true) {
    try {
      // useAPIBase: true -> http://localhost:8000/api/endpoint
      // useAPIBase: false -> http://localhost:8000/endpoint
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

  async getGlobalStats() {
    // stats endpoint is at /stats, not /api/stats
    const data = await this.fetchJSON('/stats', {}, false);
    if (!data) return {
      totalQuestions: 0, totalTrajectories: 0,
      passAt1: 0, passAtK: 0,
      simpleRatio: 0, mediumRatio: 0, hardRatio: 0
    };
    return data;
  }

  async getQuestions(page = 1, pageSize = 20) {
    const data = await this.fetchJSON('/questions', { page, pageSize });
    return data || { data: [], total: 0, page, pageSize };
  }

  async getTrajectories(page = 1, pageSize = 20, filters = {}) {
    // filters already contains page, pageSize and all filter params
    // Just ensure page and pageSize are set correctly
    const params = {
      ...filters,
      page,
      pageSize
    };

    const data = await this.fetchJSON('/trajectories', params);
    return data || { data: [], total: 0, page, pageSize };
  }

  async getTrajectoryDetail(id) {
    const encodedId = encodeURIComponent(id);
    const data = await this.fetchJSON(`/trajectories/${encodedId}`);
    return data;
  }
}

const backend = new APIBackend();

// ==========================================
// 2. UI Components
// ==========================================

const StatCard = ({ title, value, subtext, color = "blue", icon: Icon }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-start space-x-4`}>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
      {Icon && <Icon size={24} />}
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  </div>
);

const DifficultyBadge = ({ level }) => {
  const getStyle = (lvl) => {
    if (lvl === "Easy" || lvl === "简单") return "bg-green-100 text-green-700 border-green-200";
    if (lvl === "Medium" || lvl === "中等") return "bg-yellow-100 text-yellow-700 border-yellow-200";
    if (lvl === "Hard" || lvl === "困难") return "bg-red-100 text-red-700 border-red-200";
    return "bg-gray-100 text-gray-600";
  };

  const getLabel = (lvl) => {
     if (lvl === "简单") return "Easy";
     if (lvl === "中等") return "Medium";
     if (lvl === "困难") return "Hard";
     return lvl;
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStyle(level)}`}>
      {getLabel(level)}
    </span>
  );
};

const ResultBadge = ({ success }) => (
  success ?
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200"><CheckCircle size={12} className="mr-1"/> Success</span> :
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200"><XCircle size={12} className="mr-1"/> Fail</span>
);

const Pagination = ({ current, total, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  if (total === 0) return null;

  const handleJump = () => {
    const page = parseInt(inputValue);
    if (isNaN(page) || page < 1 || page > totalPages) {
      setError(`请输入 1-${totalPages} 之间的页码`);
      return;
    }
    setError('');
    setInputValue('');
    onChange(page);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(1, current - 1))} disabled={current === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50">Prev</button>
        <button onClick={() => onChange(Math.min(totalPages, current + 1))} disabled={current === totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50">Next</button>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-500">{current} / {totalPages} 页</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">共 <span className="font-medium text-slate-700">{total.toLocaleString()}</span> 条</span>

        {/* 跳转输入框 */}
        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
          <span className="text-slate-500">跳转</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            onKeyPress={handleKeyPress}
            placeholder={`1-${totalPages}`}
            className={`w-20 px-2 py-1 border rounded text-sm text-center ${
              error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
            } focus:outline-none focus:ring-2`}
          />
          <button
            onClick={handleJump}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={!inputValue}
          >
            GO
          </button>
          {error && <span className="text-xs text-red-500 whitespace-nowrap">{error}</span>}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. Views (Pages)
// ==========================================

// --- Page 1: Dashboard View ---
const DashboardView = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qLoading, setQLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);

  useEffect(() => {
    loadStats();
    loadQuestions(1);
  }, []);

  const loadStats = async () => {
    const data = await backend.getGlobalStats();
    setStats(data);
    setLoading(false);
  };

  const loadQuestions = async (p) => {
    setQLoading(true);
    const res = await backend.getQuestions(p, 10);
    setQuestions(res.data);
    setTotalQuestions(res.total);
    setPage(p);
    setQLoading(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading statistics...</div>;

  return (
    <div className="space-y-6">
      {/* Top Section: Big Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Questions / Traj." value={`${stats.totalQuestions} / ${stats.totalTrajectories}`} subtext="Coverage 100%" icon={FileText} color="blue" />
        <StatCard title="Pass@1 (Avg. Success)" value={`${(stats.passAt1 * 100).toFixed(1)}%`} subtext="Avg. Accuracy" icon={Activity} color="indigo" />
        <StatCard title="Pass@k (Solve Rate)" value={`${(stats.passAtK * 100).toFixed(1)}%`} subtext="At least one success" icon={CheckCircle} color="emerald" />
        <StatCard title="Difficulty (Easy/Med/Hard)" value={`${(stats.simpleRatio*100).toFixed(0)}% / ${(stats.mediumRatio*100).toFixed(0)}% / ${(stats.hardRatio*100).toFixed(0)}%`} subtext="Auto-graded by Pass Rate" icon={BarChart2} color="orange" />
      </div>

      {/* Bottom Section: Question List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center"><HelpCircle size={18} className="mr-2 text-slate-500"/> Question Details</h3>
          <span className="text-xs text-slate-500">Sorted by ID</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase w-32">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Question (Prompt)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase w-40">Success Rate (m/n)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase w-32">Difficulty</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {qLoading ? <tr><td colSpan="5" className="px-6 py-10 text-center text-slate-500">Loading...</td></tr> : questions.map((q) => (
                <tr key={q.id} onClick={() => onNavigate(q.id)} className="hover:bg-blue-50 transition-colors cursor-pointer group">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500 group-hover:text-blue-600 font-medium">{q.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-800"><div className="max-w-xl truncate" title={q.question}>{q.question}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    <div className="flex items-center">
                      <span className="font-medium mr-2">{(q.rate * 100).toFixed(0)}%</span>
                      <span className="text-xs text-slate-400">({q.successCount}/{q.totalCount})</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${q.rate * 100}%` }}></div></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><DifficultyBadge level={q.difficulty} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="text-slate-400 hover:text-blue-600 transition-colors" title="View Trajectories">
                        <ExternalLink size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination current={page} total={totalQuestions} pageSize={10} onChange={loadQuestions} />
      </div>
    </div>
  );
};

// --- Page 2: Trajectory List View ---
// 表格列定义
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

const TrajectoryView = ({ onSelectTrajectory, state, setState }) => {
  const [loading, setLoading] = useState(false);
  const filterTimeoutRef = useRef(null);

  // 列筛选状态 - 当state.isLoaded为false时重置
  const [columnFilters, setColumnFilters] = useState(() => {
    return TABLE_COLUMNS.reduce((acc, col) => ({
      ...acc,
      [col.id]: {
        field: col.id,
        type: col.filterType,
        active: false,
        value: '',
        selected: [],
        conditions: {},
      }
    }), {});
  });

  // 排序状态 - 当state.isLoaded为false时重置
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');

  // 当state被重置时，也重置筛选和排序状态
  useEffect(() => {
    if (!state.isLoaded) {
      const resetFilters = TABLE_COLUMNS.reduce((acc, col) => ({
        ...acc,
        [col.id]: {
          field: col.id,
          type: col.filterType,
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

  // 筛选面板显示状态
  const [openFilterPanel, setOpenFilterPanel] = useState(null);

  // 处理筛选面板切换
  useEffect(() => {
    const handleToggleFilter = (event) => {
      const columnId = event.detail;
      setOpenFilterPanel(openFilterPanel === columnId ? null : columnId);
    };

    window.addEventListener('toggleFilter', handleToggleFilter);

    // 点击外部关闭筛选面板
    const handleClickOutside = (event) => {
      if (openFilterPanel) {
        const panel = document.getElementById(`filter-panel-${openFilterPanel}`);
        if (panel && !panel.contains(event.target)) {
          const button = event.target.closest('button');
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
      window.removeEventListener('toggleFilter', handleToggleFilter);
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
    const params = {};

    Object.entries(columnFilters).forEach(([field, filter]) => {
      if (!filter.active) return;

      if (field === 'trajectory_id' && filter.value) {
        params.trajectory_id = filter.value;
      } else if (field === 'questionId' && filter.value) {
        params.data_id = filter.value;
      } else if (field === 'task.question' && filter.value) {
        params.question = filter.value;
      } else if (field === 'isSuccess' && filter.selected?.length > 0) {
        // 只选了Success或只选了Failed时才筛选，两个都选相当于不筛选
        if (filter.selected.length === 1) {
          params.is_success = filter.selected.includes('Success') ? 'true' : 'false';
        }
      } else if (field === 'termination_reason' && filter.selected?.length > 0) {
        params.termination_reason = filter.selected.join(',');
      } else if (field === 'rootCause' && filter.value) {
        params.question = filter.value; // 搜索问题文本
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

  const loadData = async (page) => {
    setLoading(true);

    try {
      const filterParams = buildFilterParams();
      const sortParams = sortField ? { field: sortField, order: sortOrder } : null;

      // 调用后端API
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

  // 处理筛选应用
  const handleFilterApply = (field) => {
    setColumnFilters(prev => {
      const updated = {
        ...prev,
        [field]: { ...prev[field], active: true }
      };
      // 立即使用更新后的值构建参数
      const params = buildFilterParamsFromFilters(updated);
      // 异步加载数据
      setTimeout(() => loadDataWithParams(1, params), 0);
      return updated;
    });
  };

  // 从filters对象直接构建参数（不依赖state）
  const buildFilterParamsFromFilters = (filters) => {
    const params = {};

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
        // 只选了Success或只选了Failed时才筛选，两个都选相当于不筛选
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

  // 使用指定的参数加载数据
  const loadDataWithParams = async (page, filterParams) => {
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

  // 处理筛选清除
  const handleFilterClear = (field) => {
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
      // 立即使用更新后的值构建参数
      const params = buildFilterParamsFromFilters(updated);
      // 异步加载数据
      setTimeout(() => loadDataWithParams(1, params), 0);
      return updated;
    });
  };

  // 清除所有筛选
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
    // 使用空参数加载所有数据
    setTimeout(() => loadDataWithParams(1, {}), 0);
  };

  // 处理排序
  const handleSort = (field) => {
    let newSortField, newSortOrder;

    if (sortField === field) {
      // 切换排序方向
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      newSortField = field;
    } else {
      newSortField = field;
      newSortOrder = 'desc';
    }

    setSortField(newSortField);
    setSortOrder(newSortOrder);

    // 立即使用当前的筛选条件和新的排序参数加载
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

  // 获取激活的筛选器数量
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

            {/* 激活筛选器徽章 */}
            {(activeFilterCount > 0 || sortField) && (
              <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                {sortField && ` • Sorted by ${sortField}`}
              </span>
            )}
          </div>

          {/* 清除所有按钮 */}
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
                        {/* 排序按钮 */}
                        {col.sortable && (
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
                        )}

                        {/* 非排序列 */}
                        {!col.sortable && (
                          <span className="text-xs font-medium text-slate-600">{col.label}</span>
                        )}

                        {/* 筛选按钮 */}
                        <div className="relative inline-block" ref={(el) => {
                          // Store ref for each column filter panel
                          if (!window.filterRefs) window.filterRefs = {};
                          window.filterRefs[col.id] = el;
                        }}>
                          <button
                            onClick={() => {
                              // Toggle filter panel for this column
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

                          {/* 筛选面板 */}
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
                        </div>

                        {/* 清除单个筛选 */}
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
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {!state.isLoaded && loading ? (
                 <tr><td colSpan="14" className="p-10 text-center text-slate-500">Initializing...</td></tr>
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
                  <tr><td colSpan="14" className="p-10 text-center text-slate-400">No results found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination current={state.page} total={state.total} pageSize={15} onChange={(p) => loadData(p)} />
      </div>
    </div>
  );
};

// --- Page 2-Detail: Trajectory Detail View ---
const TrajectoryDetailView = ({ trajectoryId, onBack }) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend.getTrajectoryDetail(trajectoryId)
      .then(res => {
        if (!res) setError("Failed to load trajectory");
        else setData(res);
      });
  }, [trajectoryId]);

  if (error) return <div className="p-10 text-center text-red-500">{error} <button onClick={onBack} className="ml-4 underline">Back</button></div>;
  if (!data) return <div className="p-10 text-center text-slate-500 flex items-center justify-center min-h-[300px]"><Loader2 className="animate-spin mr-2"/> Loading details...</div>;

  const renderMessage = (msg, idx) => {
    let roleColor = "bg-gray-100 border-gray-200";
    let RoleIcon = User;

    if (msg.role === 'user') {
      roleColor = "bg-blue-50 border-blue-100";
      RoleIcon = User;
    } else if (msg.role === 'assistant') {
      roleColor = "bg-white border-slate-200";
      RoleIcon = Bot;
    } else if (msg.role === 'tool') {
      roleColor = "bg-purple-50 border-purple-100";
      RoleIcon = Terminal;
    }

    const formatContent = (content) => {
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      return <div className="whitespace-pre-wrap font-mono text-sm text-slate-700">{contentStr}</div>;
    };

    return (
      <div key={idx} className={`flex gap-4 p-4 mb-3 rounded-lg border ${roleColor}`}>
        <div className={`mt-1 p-1.5 rounded-full h-fit ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : msg.role === 'tool' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
          <RoleIcon size={16} />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center mb-1">
            <span className="text-xs font-bold uppercase text-slate-500 mr-2">{msg.role}</span>
          </div>
          {formatContent(msg.content)}
        </div>
      </div>
    );
  };

  const renderStep = (step, idx) => {
    return (
      <div key={idx} className="flex gap-4 p-4 mb-3 rounded-lg border bg-slate-50 border-slate-200">
        <div className="mt-1 p-1.5 rounded-full h-fit bg-blue-100 text-blue-600">
          <Terminal size={16} />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center mb-2">
            <span className="text-xs font-bold uppercase text-slate-500 mr-2">Step {step.step_id}</span>
            {step.action && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                {step.action}
              </span>
            )}
          </div>

          {step.thought && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-slate-500 mb-1">Thought:</div>
              <div className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200">
                {step.thought}
              </div>
            </div>
          )}

          {step.model_response && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-slate-500 mb-1">Response:</div>
              <div className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200">
                {step.model_response}
              </div>
            </div>
          )}

          {step.observation && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Observation:</div>
              <div className="text-sm text-slate-700 bg-green-50 p-2 rounded border border-green-200">
                {step.observation}
              </div>
            </div>
          )}

          {step.done && (
            <div className="mt-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                ✓ Completed
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center space-x-4">
        <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center text-slate-600 hover:text-slate-900">
          <ArrowLeft size={20} className="mr-1"/> <span className="font-medium">Back to List</span>
        </button>
        <div className="flex-1"></div>
        <div className="text-right">
            <div className="text-xs text-slate-400 font-mono mb-1">{data.trajectory_id}</div>
            <ResultBadge success={data.isSuccess} />
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center"><Cpu size={14} className="mr-1"/> Agent Info</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="font-mono">{data.agent_name || 'N/A'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Epoch:</span> <span className="font-mono">{data.epoch_id || 0}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Train ID:</span> <span className="font-mono truncate w-20" title={data.training_id}>{data.training_id || 'N/A'}</span></div>
          </div>
        </div>

        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center"><Target size={14} className="mr-1"/> Metrics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Final Reward:</span> <span className={`font-mono font-bold ${data.reward > 0 ? 'text-green-600' : 'text-red-600'}`}>{(data.reward || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tool Reward:</span> <span className="font-mono">{(data.toolcall_reward || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Res Reward:</span> <span className="font-mono">{(data.res_reward || 0).toFixed(2)}</span></div>
          </div>
        </div>

        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center"><Clock size={14} className="mr-1"/> Execution</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Time:</span> <span className="font-mono">{(data.exec_time || 0).toFixed(2)}s</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Reason:</span> <span className="font-mono">{data.termination_reason || "-"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Data ID:</span> <span className="font-mono">{data.data_id || data.questionId || "-"}</span></div>
          </div>
        </div>

        <div className="col-span-1 bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
          <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center"><Box size={14} className="mr-1"/> Task Context</h4>
          <div className="text-sm text-slate-700 font-medium line-clamp-3" title={data.task?.question}>
            Q: {data.task?.question || "No Question Text"}
          </div>
        </div>
      </div>

      {/* Chat Flow Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Execution Flow (Chat History)</h3>
        </div>
        <div className="p-6 bg-slate-50/50 min-h-[400px]">
          {data.chat_completions && data.chat_completions.length > 0 ? (
            data.chat_completions.map((msg, idx) => renderMessage(msg, idx))
          ) : data.steps && data.steps.length > 0 ? (
            data.steps.map((step, idx) => renderStep(step, idx))
          ) : (
            <div className="text-center text-slate-400 py-10">No execution data found</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. Main App Layout
// ==========================================

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState(null);

  const [trajectoryViewState, setTrajectoryViewState] = useState({
    page: 1,
    searchType: 'id',
    searchTerm: '',
    trajectories: [],
    total: 0,
    isLoaded: false
  });

  const resetTrajectoryViewState = () => {
    setTrajectoryViewState({
      page: 1,
      searchType: 'id',
      searchTerm: '',
      trajectories: [],
      total: 0,
      isLoaded: false
    });
  };

  const handleNavigateToTrajectories = (questionId) => {
    setTrajectoryViewState({
        page: 1,
        searchType: 'questionId',
        searchTerm: questionId,
        trajectories: [],
        total: 0,
        isLoaded: false
    });
    setActiveTab('trajectories');
    setSelectedTrajectoryId(null);
  };

  const renderContent = () => {
    if (activeTab === 'trajectories' && selectedTrajectoryId) {
      return (
        <TrajectoryDetailView
          trajectoryId={selectedTrajectoryId}
          onBack={() => setSelectedTrajectoryId(null)}
        />
      );
    }

    switch(activeTab) {
      case "dashboard":
        return <DashboardView onNavigate={handleNavigateToTrajectories} />;
      case "trajectories":
        return (
            <TrajectoryView
                onSelectTrajectory={(id) => setSelectedTrajectoryId(id)}
                state={trajectoryViewState}
                setState={setTrajectoryViewState}
            />
        );
      case "analysis":
        // Analysis 页面暂时隐藏，显示提示
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <AlertOctagon size={48} className="text-slate-300 mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Analysis Page</h2>
            <p className="text-slate-500">此功能正在开发中，敬请期待...</p>
          </div>
        );
      case "import": return <ImportView />;
      default: return <DashboardView />;
    }
  };

  const NavItem = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        if (id === 'trajectories') {
          // 切换到trajectories标签时重置状态以触发数据加载
          resetTrajectoryViewState();
        }
        setSelectedTrajectoryId(null);
      }}
      className={`w-full flex items-center px-4 py-3 text-sm font-medium transition-colors ${
        activeTab === id
        ? "bg-blue-50 text-blue-600 border-r-4 border-blue-600"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <Icon size={18} className="mr-3" />
      {label}
    </button>
  );

  // 可用的导航项（暂时隐藏 Analysis）
  const NAV_ITEMS = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "trajectories", label: "Trajectories", icon: FileText },
    // { id: "analysis", label: "Analysis", icon: AlertOctagon },  // 暂时隐藏
    { id: "import", label: "Import Data", icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <aside className="w-64 bg-white border-r border-slate-200 fixed h-full hidden md:block z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3">T</div>
          <span className="font-bold text-lg text-slate-800">Trajectory<span className="text-blue-600">.AI</span></span>
        </div>
        <nav className="mt-6 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
        <div className="w-full">
          {!selectedTrajectoryId && activeTab !== 'analysis' && (
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">
                {activeTab === 'dashboard' && 'Analytics Overview'}
                {activeTab === 'trajectories' && 'Trajectory List'}
                {activeTab === 'import' && 'Import Trajectory Data'}
              </h1>
            </div>
          )}
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
