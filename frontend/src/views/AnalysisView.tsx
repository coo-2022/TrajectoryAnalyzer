import { BarChart3 } from 'lucide-react';
import TrainingProgressDashboard from '../components/analysis/TrainingProgressDashboard';

export default function AnalysisView() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-800">Training Progress</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Analyze training metrics across epochs and iterations
        </p>
      </header>

      {/* Content */}
      <main className="p-6">
        <TrainingProgressDashboard />
      </main>
    </div>
  );
}
