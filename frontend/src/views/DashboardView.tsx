import React, { useState, useEffect } from 'react';
import { FileText, Activity, CheckCircle, BarChart2, AlertTriangle, ChevronRight } from 'lucide-react';
import { StatCard, DifficultyBadge } from '../components/common';

// ==========================================
// API Backend
// ==========================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
const API_ROOT = import.meta.env.VITE_API_ROOT_URL || "http://localhost:8000";

class APIBackend {
  async fetchJSON(endpoint: string, params: Record<string, any> = {}, useAPIBase: boolean = true) {
    try {
      const baseURL = useAPIBase ? API_BASE : API_ROOT;
      // 支持相对路径（用于外部访问时通过前端代理）
      const urlString = baseURL ? `${baseURL}${endpoint}` : endpoint;
      const url = new URL(urlString, window.location.origin);
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== '') {
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

  async getGlobalStats() {
    const data = await this.fetchJSON('/stats', {}, false);
    if (!data) return {
      totalQuestions: 0, totalTrajectories: 0,
      passAt1: 0, passAtK: 0,
      simpleRatio: 0, mediumRatio: 0, hardRatio: 0
    };
    return data;
  }

  async getLatestEpochStats() {
    const data = await this.fetchJSON('/api/analysis-stats/latest-epoch', {}, true);
    if (!data) return {
      latest_epoch: null,
      total_trajectories: 0,
      difficulty_distribution: { easy: { count: 0, ratio: 0 }, medium: { count: 0, ratio: 0 }, hard: { count: 0, ratio: 0 } },
      top5_difficult: []
    };
    return data;
  }
}

const backend = new APIBackend();

// ==========================================
// Types
// ==========================================

interface DifficultQuestion {
  data_id: string;
  question: string;
  success_rate: number;
  total_count: number;
}

interface DifficultyDistribution {
  easy: { count: number; ratio: number };
  medium: { count: number; ratio: number };
  hard: { count: number; ratio: number };
}

interface LatestEpochStats {
  latest_epoch: number | null;
  total_trajectories: number;
  difficulty_distribution: DifficultyDistribution;
  top5_difficult: DifficultQuestion[];
}

interface DashboardViewProps {
  onNavigate?: (questionId: string, filters?: any) => void;
}

// ==========================================
// Sub Components
// ==========================================

const DifficultyBarChart: React.FC<{ distribution: DifficultyDistribution; total: number }> = ({ distribution, total }) => {
  const maxCount = Math.max(distribution.easy.count, distribution.medium.count, distribution.hard.count, 1);

  const bars = [
    { label: 'Easy', count: distribution.easy.count, ratio: distribution.easy.ratio, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
    { label: 'Medium', count: distribution.medium.count, ratio: distribution.medium.ratio, color: 'bg-amber-500', textColor: 'text-amber-600' },
    { label: 'Hard', count: distribution.hard.count, ratio: distribution.hard.ratio, color: 'bg-rose-500', textColor: 'text-rose-600' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <BarChart2 size={18} className="text-blue-500" />
          Difficulty Distribution
        </h3>
        <span className="text-xs text-slate-400">{total} questions</span>
      </div>
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span className="text-sm text-slate-600 w-16">{bar.label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
              <div
                className={`${bar.color} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                style={{ width: `${(bar.count / maxCount) * 100}%`, minWidth: bar.count > 0 ? '32px' : '0' }}
              >
                {bar.count > 0 && <span className="text-xs text-white font-medium">{bar.count}</span>}
              </div>
            </div>
            <span className={`text-sm font-medium ${bar.textColor} w-12 text-right`}>
              {(bar.ratio * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Top5Difficult: React.FC<{ questions: DifficultQuestion[]; onNavigate?: (id: string) => void }> = ({ questions, onNavigate }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <AlertTriangle size={18} className="text-rose-500" />
          Top 5 Difficult
        </h3>
        <span className="text-xs text-slate-400">Lowest success rate</span>
      </div>
      <div className="space-y-2">
        {questions.length === 0 ? (
          <div className="text-center text-slate-400 py-4">No data available</div>
        ) : (
          questions.map((q, idx) => (
            <div
              key={q.data_id}
              onClick={() => onNavigate?.(q.data_id)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer group transition-colors"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate group-hover:text-blue-600 transition-colors" title={q.question}>
                  {q.question}
                </p>
                <p className="text-xs text-slate-400">
                  {q.total_count} trajectories
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-sm font-bold text-rose-600">
                  {(q.success_rate * 100).toFixed(0)}%
                </span>
                <ChevronRight size={14} className="inline-block text-slate-300 group-hover:text-blue-500" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ==========================================
// Main Component
// ==========================================

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [epochStats, setEpochStats] = useState<LatestEpochStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [globalStats, latestEpoch] = await Promise.all([
      backend.getGlobalStats(),
      backend.getLatestEpochStats()
    ]);
    setStats(globalStats);
    setEpochStats(latestEpoch);
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading statistics...</div>;

  const totalQuestions = epochStats?.difficulty_distribution
    ? epochStats.difficulty_distribution.easy.count + epochStats.difficulty_distribution.medium.count + epochStats.difficulty_distribution.hard.count
    : 0;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Questions / Traj."
          value={`${stats.totalQuestions} / ${stats.totalTrajectories}`}
          subtext="Coverage 100%"
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Pass@1 (Avg. Success)"
          value={`${(stats.passAt1 * 100).toFixed(1)}%`}
          subtext="Avg. Accuracy"
          icon={Activity}
          color="indigo"
        />
        <StatCard
          title="Pass@k (Solve Rate)"
          value={`${(stats.passAtK * 100).toFixed(1)}%`}
          subtext="At least one success"
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Difficulty (Easy/Med/Hard)"
          value={`${(stats.simpleRatio * 100).toFixed(0)}% / ${(stats.mediumRatio * 100).toFixed(0)}% / ${(stats.hardRatio * 100).toFixed(0)}%`}
          subtext="Auto-graded by Pass Rate"
          icon={BarChart2}
          color="orange"
        />
      </div>

      {/* Latest Epoch Section */}
      {epochStats?.latest_epoch !== null && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-800">
              Latest Epoch (Epoch {epochStats.latest_epoch})
            </h2>
            <span className="text-sm text-slate-500">
              {epochStats.total_trajectories} trajectories
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DifficultyBarChart
              distribution={epochStats.difficulty_distribution}
              total={totalQuestions}
            />
            <Top5Difficult
              questions={epochStats.top5_difficult}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      )}
    </div>
  );
};
