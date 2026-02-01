import { useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import TerminationStatsCard from '../components/analysis/TerminationStatsCard';
import RewardCategoryStatsCard from '../components/analysis/RewardCategoryStatsCard';
import ToolReturnStatsCard from '../components/analysis/ToolReturnStatsCard';
import ProcessRewardCorrelationCard from '../components/analysis/ProcessRewardCorrelationCard';
import UnexpectedToolContextsView from '../components/analysis/UnexpectedToolContextsView';

type TabType = 'overview' | 'tool-contexts';

export default function AnalysisView() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800">Trajectory Analysis</h1>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tool-contexts')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'tool-contexts'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tool Contexts
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6" key={refreshKey}>
            {/* First Row: Termination and Reward */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TerminationStatsCard />
              <RewardCategoryStatsCard />
            </div>

            {/* Second Row: Tool Returns */}
            <div className="grid grid-cols-1 gap-6">
              <ToolReturnStatsCard />
            </div>

            {/* Third Row: Correlation */}
            <div className="grid grid-cols-1 gap-6">
              <ProcessRewardCorrelationCard />
            </div>
          </div>
        )}

        {activeTab === 'tool-contexts' && (
          <div key={refreshKey}>
            <UnexpectedToolContextsView />
          </div>
        )}
      </main>
    </div>
  );
}
