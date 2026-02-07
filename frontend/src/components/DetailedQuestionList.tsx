import React, { useState } from 'react';
import { ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { DifficultyBadge } from './common';
import { Pagination } from './Pagination';

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

interface DetailedQuestionListProps {
  questions: Question[];
  loading: boolean;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  onNavigate: (question: Question) => void;
}

type SortOrder = 'asc' | 'desc' | null;

export const DetailedQuestionList: React.FC<DetailedQuestionListProps> = ({
  questions,
  loading,
  page,
  total,
  onPageChange,
  onNavigate,
}) => {
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

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
        <h3 className="font-semibold text-slate-800">Question Details (Full)</h3>
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
        onChange={onPageChange}
      />
    </div>
  );
};
