import { useState, useEffect } from 'react';
import { TrendingUp, GitBranch } from 'lucide-react';
import EpochLevelView from './EpochLevelView';
import IterationLevelView from './IterationLevelView';

// API Backend
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface TrainingRun {
  training_id: string;
  label: string;
}

export default function TrainingProgressDashboard() {
  const [activeView, setActiveView] = useState<'epoch' | 'iteration'>('epoch');
  const [trainingRuns, setTrainingRuns] = useState<TrainingRun[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取 training runs 列表
  useEffect(() => {
    const fetchTrainingRuns = async () => {
      try {
        const response = await fetch(`${API_BASE}/training-stats/training-runs`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();

        const runs = data.training_ids.map((id: string) => ({
          training_id: id,
          label: `Training ${id}`
        }));

        setTrainingRuns(runs);
      } catch (error) {
        console.error('Failed to fetch training runs:', error);
        setTrainingRuns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrainingRuns();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading training data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-slate-700">View Dimension:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('epoch')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === 'epoch'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Epoch Level
            </button>
            <button
              onClick={() => setActiveView('iteration')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === 'iteration'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Iteration Level
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeView === 'epoch' ? (
        <EpochLevelView trainingRuns={trainingRuns} />
      ) : (
        <IterationLevelView trainingRuns={trainingRuns} />
      )}
    </div>
  );
}
