import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ==========================================
// StatCard Component
// ==========================================

interface StatCardProps {
  title: string;
  value: string;
  subtext: string;
  color?: 'blue' | 'indigo' | 'emerald' | 'orange' | 'red';
  icon?: LucideIcon;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, color = "blue", icon: Icon }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-start space-x-4`}>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
      {Icon && <Icon size={24} />}
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className={`text-2xl font-bold text-${color}-600 mt-1`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{subtext}</p>
    </div>
  </div>
);

// ==========================================
// DifficultyBadge Component
// ==========================================

interface DifficultyBadgeProps {
  level: 'Easy' | 'Medium' | 'Hard' | string;
}

const getLabel = (level: string) => {
  const levelMap: Record<string, string> = {
    'Easy': 'Easy',
    'Medium': 'Med',
    'Hard': 'Hard'
  };
  return levelMap[level] || level;
};

const getColorClasses = (level: string) => {
  const colorMap: Record<string, string> = {
    'Easy': 'bg-green-50 text-green-700 border-green-200',
    'Medium': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Hard': 'bg-red-50 text-red-700 border-red-200'
  };
  return colorMap[level] || 'bg-gray-50 text-gray-700 border-gray-200';
};

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ level }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColorClasses(level)}`}>
      {getLabel(level)}
    </span>
  );
};

// ==========================================
// ResultBadge Component
// ==========================================

interface ResultBadgeProps {
  success: boolean;
}

export const ResultBadge: React.FC<ResultBadgeProps> = ({ success }) => (
  success ?
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
    <CheckCircle size={12} className="mr-1"/> Success
  </span> :
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
    <XCircle size={12} className="mr-1"/> Fail
  </span>
);
