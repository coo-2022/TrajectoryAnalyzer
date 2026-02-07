import React, { useState, useEffect } from 'react';
import { ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { DifficultyBadge } from '../components/common';
import { Pagination } from '../components/Pagination';

// ==========================================
// API Backend
// ==========================================

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

class APIBackend {
  async fetchJSON(endpoint: string, params: Record<string, any> = {}) {
    try {
      const url = new URL(`${API_BASE}${endpoint}`);
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

  async getQuestions(page: number = 1, pageSize: number = 20) {
    const data = await this.fetchJSON('/questions', { page, pageSize });
    return data || { data: [], total: 0, page, pageSize };
  }
}

const backend = new APIBackend();

// ==========================================
// Types
// ==========================================

interface Question {
  id: string;
  question: string;
  successCount: number;
  totalCount: number;
  rate: number;
  difficulty: string;
  training_id: string;
  epoch_id: number | null;
  iteration_id: number | null;
  sample_id: number | null;
}

interface QuestionsViewProps {
  onNavigate: (question: Question) => void;
}

type SortOrder = 'asc' | 'desc' | null;

// ==========================================
// Component
// ==========================================

export const QuestionsView: React.FC<QuestionsViewProps> = ({ onNavigate }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    loadQuestions(1);
  }, []);

  const loadQuestions = async (p: number) => {
    setLoading(true);
    const res = await backend.getQuestions(p, 10);
    setQuestions(res.data);
    setTotal(res.total);
    setPage(p);
    setLoading(false);
  };

  const handleSort = () => {
    if (sortOrder === null) {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortOrder(null);
    }
  };

  const getSortedQuestions = () => {
    if (!sortOrder) return questions;

    const sorted = [...questions].sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.rate - b.rate;
      } else {
        return b.rate - a.rate;
      }
    });

    return sorted;
  };

  const sortedQuestions = getSortedQuestions();
  const sortIcon = sortOrder === 'asc' ? <ArrowUp size={14} /> : sortOrder === 'desc' ? <ArrowDown size={14} /> : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <h3 className="font-semibold text-slate-800">Questions</h3>
        <span className="text-xs text-slate-500">
          {sortOrder ? `Sorted by Success Rate ${sortOrder === 'asc' ? '↑' : '↓'}` : 'Click Success Rate to sort'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-32">Train ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-20">Epoch</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-24">Iteration</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-20">Sample</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Question</th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-40 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={handleSort}
              >
                <div className="flex items-center gap-1">
                  Success Rate
                  {sortIcon}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-28">Difficulty</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-500">Loading...</td></tr>
            ) : sortedQuestions.map((q) => (
              <tr
                key={q.id}
                onClick={() => onNavigate(q)}
                className="hover:bg-blue-50 transition-colors cursor-pointer group"
              >
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-slate-500 group-hover:text-blue-600">
                  {q.training_id || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                  {q.epoch_id ?? '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                  {q.iteration_id ?? '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                  {q.sample_id ?? '-'}
                </td>
                <td className="px-4 py-4 text-sm text-slate-800">
                  <div className="max-w-md truncate" title={q.question}>{q.question}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
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
                <td className="px-4 py-4 whitespace-nowrap">
                  <DifficultyBadge level={q.difficulty} />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-right">
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
        total={total}
        pageSize={10}
        onChange={loadQuestions}
      />
    </div>
  );
};
