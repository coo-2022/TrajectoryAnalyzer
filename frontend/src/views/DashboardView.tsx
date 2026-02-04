import React, { useState, useEffect } from 'react';
import { FileText, Activity, CheckCircle, BarChart2, HelpCircle, ExternalLink } from 'lucide-react';
import { StatCard, DifficultyBadge } from '../components/common';
import { Pagination } from '../components/Pagination';

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

  async getGlobalStats() {
    const data = await this.fetchJSON('/stats', {}, false);
    if (!data) return {
      totalQuestions: 0, totalTrajectories: 0,
      passAt1: 0, passAtK: 0,
      simpleRatio: 0, mediumRatio: 0, hardRatio: 0
    };
    return data;
  }

  async getQuestions(page: number = 1, pageSize: number = 20) {
    const data = await this.fetchJSON('/questions', { page, pageSize });
    return data || { data: [], total: 0, page, pageSize };
  }
}

const backend = new APIBackend();

// ==========================================
// Types
// ==========================================

interface DashboardViewProps {
  onNavigate: (questionId: string) => void;
}

// ==========================================
// Component
// ==========================================

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
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

  const loadQuestions = async (p: number) => {
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
          value={`${(stats.simpleRatio*100).toFixed(0)}% / ${(stats.mediumRatio*100).toFixed(0)}% / ${(stats.hardRatio*100).toFixed(0)}%}`}
          subtext="Auto-graded by Pass Rate"
          icon={BarChart2}
          color="orange"
        />
      </div>

      {/* Bottom Section: Question List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-800 flex items-center">
            <HelpCircle size={18} className="mr-2 text-slate-500"/>
            Question Details
          </h3>
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
              {qLoading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">Loading...</td></tr>
              ) : questions.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => onNavigate(q.id)}
                  className="hover:bg-blue-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500 group-hover:text-blue-600 font-medium">
                    {q.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-800">
                    <div className="max-w-xl truncate" title={q.question}>{q.question}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    <div className="flex items-center">
                      <span className="font-medium mr-2">{(q.rate * 100).toFixed(0)}%</span>
                      <span className="text-xs text-slate-400">({q.successCount}/{q.totalCount})</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${q.rate * 100}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <DifficultyBadge level={q.difficulty} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      className="text-slate-400 hover:text-blue-600 transition-colors"
                      title="View Trajectories"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          current={page}
          total={totalQuestions}
          pageSize={10}
          onChange={loadQuestions}
        />
      </div>
    </div>
  );
};
