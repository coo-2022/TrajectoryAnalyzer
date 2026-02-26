import React, { useState, useEffect } from 'react';
import { FileText, Activity, CheckCircle, BarChart2 } from 'lucide-react';
import { StatCard } from '../components/common';

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

}

const backend = new APIBackend();

// ==========================================
// Types
// ==========================================

interface DashboardViewProps {
  onNavigate?: (questionId: string, filters?: any) => void;
}

// ==========================================
// Main Component
// ==========================================

export const DashboardView: React.FC<DashboardViewProps> = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const globalStats = await backend.getGlobalStats();
    setStats(globalStats);
    setLoading(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading statistics...</div>;

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
    </div>
  );
};
