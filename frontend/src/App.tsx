import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  AlertOctagon,
  Upload,
  HelpCircle,
} from 'lucide-react';
import AnalysisView from './views/AnalysisView';
import ImportView from './views/ImportView';
import { TrajectoryView } from './views/TrajectoryView';
import type { TrajectoryViewState } from './views/TrajectoryView';
import { DashboardView } from './views/DashboardView';
import { QuestionsView } from './views/QuestionsView';
import { TrajectoryDetailView } from './views/TrajectoryDetailView';

// ==========================================
// Main App Layout
// ==========================================

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(null);

  const [trajectoryViewState, setTrajectoryViewState] = useState<TrajectoryViewState>({
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

  const handleNavigateToTrajectories = (questionIdOrQuestion: string | any, filters?: {
    trainingId?: string;
    epochId?: number | null;
    iterationId?: number | null;
    sampleId?: number | null;
  }) => {
    // Handle both string questionId and question object
    const questionId = typeof questionIdOrQuestion === 'string' ? questionIdOrQuestion : questionIdOrQuestion.id;
    const questionFilters = typeof questionIdOrQuestion === 'object' ? {
      trainingId: questionIdOrQuestion.training_id,
      epochId: questionIdOrQuestion.epoch_id,
      iterationId: questionIdOrQuestion.iteration_id,
      sampleId: questionIdOrQuestion.sample_id,
    } : filters;

    setTrajectoryViewState({
      page: 1,
      searchType: 'questionId',
      searchTerm: questionId,
      trajectories: [],
      total: 0,
      isLoaded: false,
      trainingId: questionFilters?.trainingId,
      epochId: questionFilters?.epochId,
      iterationId: questionFilters?.iterationId,
      sampleId: questionFilters?.sampleId,
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
      case "questions":
        return <QuestionsView onNavigate={handleNavigateToTrajectories} />;
      case "trajectories":
        return (
          <TrajectoryView
            onSelectTrajectory={(id) => setSelectedTrajectoryId(id)}
            state={trajectoryViewState}
            setState={setTrajectoryViewState}
          />
        );
      case "analysis":
        return <AnalysisView />;
      case "import": return <ImportView />;
      default: return <DashboardView onNavigate={handleNavigateToTrajectories} />;
    }
  };

  const NavItem = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        if (id === 'trajectories') {
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

  const NAV_ITEMS = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "questions", label: "Questions", icon: HelpCircle },
    { id: "trajectories", label: "Trajectories", icon: FileText },
    { id: "analysis", label: "Analysis", icon: AlertOctagon },
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
          {!selectedTrajectoryId && (
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">
                {activeTab === 'dashboard' && 'Analytics Overview'}
                {activeTab === 'questions' && 'Questions'}
                {activeTab === 'trajectories' && 'Trajectory List'}
                {activeTab === 'analysis' && 'Analysis'}
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
