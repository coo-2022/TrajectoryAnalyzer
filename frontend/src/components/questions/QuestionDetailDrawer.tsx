import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowLeft, ChevronRight, Filter, Target, BarChart2, Calendar, Hash, CheckCircle2, XCircle, Clock, Cpu, Terminal } from 'lucide-react';
import { DifficultyBadge } from '../common';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

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

interface Trajectory {
  trajectory_id: string;
  data_id: string;
  reward: number;
  training_id: string;
  epoch_id: number;
  iteration_id: number;
  agent_name: string;
  termination_reason: string;
  exec_time: number;
  isSuccess?: boolean;
}

interface QuestionDetailDrawerProps {
  question: Question | null;
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'list' | 'detail';

export const QuestionDetailDrawer: React.FC<QuestionDetailDrawerProps> = ({
  question,
  isOpen,
  onClose
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(null);
  const [trajectories, setTrajectories] = useState<Trajectory[]>([]);
  const [loading, setLoading] = useState(false);
  const [trajectoryDetail, setTrajectoryDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 过滤状态
  const [filterTrainingId, setFilterTrainingId] = useState<string>('');
  const [filterEpochId, setFilterEpochId] = useState<string>('');

  // 获取所有可用的 training_id 和 epoch_id（用于过滤下拉框）
  const availableTrainings = useMemo(() => {
    const ids = new Set<string>();
    trajectories.forEach(t => {
      if (t.training_id) ids.add(t.training_id);
    });
    return Array.from(ids).sort();
  }, [trajectories]);

  const availableEpochs = useMemo(() => {
    const ids = new Set<number>();
    trajectories.forEach(t => {
      if (t.epoch_id !== undefined && t.epoch_id !== null) {
        ids.add(t.epoch_id);
      }
    });
    return Array.from(ids).sort((a, b) => a - b);
  }, [trajectories]);

  // 加载轨迹列表
  useEffect(() => {
    if (!question || !isOpen) return;

    const loadTrajectories = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('page', '1');
        params.append('pageSize', '100');
        if (filterTrainingId) params.append('training_id', filterTrainingId);
        if (filterEpochId) params.append('epoch_id', filterEpochId);

        const response = await fetch(
          `${API_BASE}/questions/${encodeURIComponent(question.id)}/trajectories?${params}`
        );
        if (response.ok) {
          const data = await response.json();
          setTrajectories(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load trajectories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrajectories();
  }, [question, isOpen, filterTrainingId, filterEpochId]);

  // 加载轨迹详情
  useEffect(() => {
    if (!selectedTrajectoryId || viewMode !== 'detail') return;

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const response = await fetch(
          `${API_BASE}/trajectories/${encodeURIComponent(selectedTrajectoryId)}`
        );
        if (response.ok) {
          const data = await response.json();
          setTrajectoryDetail(data);
        }
      } catch (error) {
        console.error('Failed to load trajectory detail:', error);
      } finally {
        setDetailLoading(false);
      }
    };

    loadDetail();
  }, [selectedTrajectoryId, viewMode]);

  // 重置状态当问题变化时
  useEffect(() => {
    if (question) {
      setViewMode('list');
      setSelectedTrajectoryId(null);
      setTrajectoryDetail(null);
      setFilterTrainingId('');
      setFilterEpochId('');
    }
  }, [question?.id]);

  const handleTrajectoryClick = (trajectoryId: string) => {
    setSelectedTrajectoryId(trajectoryId);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedTrajectoryId(null);
    setTrajectoryDetail(null);
  };

  const renderMessage = (msg: any, idx: number) => {
    const roleColors: Record<string, string> = {
      user: 'bg-blue-50 border-blue-100',
      assistant: 'bg-white border-slate-200',
      tool: 'bg-purple-50 border-purple-100'
    };

    return (
      <div key={idx} className={`p-3 mb-2 rounded-lg border ${roleColors[msg.role] || 'bg-slate-50 border-slate-200'}`}>
        <div className="text-xs font-semibold text-slate-500 mb-1 capitalize">{msg.role}</div>
        <div className="text-sm text-slate-700 whitespace-pre-wrap">
          {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
        </div>
      </div>
    );
  };

  const renderStep = (step: any, idx: number) => (
    <div key={idx} className="p-3 mb-2 rounded-lg border bg-slate-50 border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <Terminal size={14} className="text-blue-500" />
        <span className="text-xs font-semibold text-slate-600">Step {step.step_id}</span>
        {step.action && (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
            {step.action}
          </span>
        )}
      </div>
      {step.thought && (
        <div className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200 mb-2">
          {step.thought}
        </div>
      )}
      {step.observation && (
        <div className="text-sm text-slate-700 bg-green-50 p-2 rounded border border-green-200">
          {step.observation}
        </div>
      )}
    </div>
  );

  if (!question) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-1/2 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            {viewMode === 'detail' && (
              <button
                onClick={handleBackToList}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                title="Back"
              >
                <ArrowLeft size={18} className="text-slate-600" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-800">
              {viewMode === 'list' ? 'Question Details' : 'Trajectory Details'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-72px)] overflow-y-auto">
          {viewMode === 'list' ? (
            <div className="flex flex-col h-full">
              {/* Upper Section: Question Info */}
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-100">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Hash size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded">
                        {question.id}
                      </span>
                      <DifficultyBadge level={question.difficulty} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 leading-relaxed">
                      {question.question}
                    </h3>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <Target size={16} />
                      <span className="text-xs font-medium uppercase">Success Rate</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {(question.rate * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {question.successCount} / {question.totalCount} trajectories
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <BarChart2 size={16} />
                      <span className="text-xs font-medium uppercase">Difficulty</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {question.difficulty}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Based on success rate
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <Calendar size={16} />
                      <span className="text-xs font-medium uppercase">Total Trajectories</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {question.totalCount}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Available for analysis
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Section: Trajectory List */}
              <div className="flex-1 p-6 bg-slate-50/30">
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4">
                  <Filter size={16} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Filter by:</span>

                  <select
                    value={filterTrainingId}
                    onChange={(e) => setFilterTrainingId(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Trainings</option>
                    {availableTrainings.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>

                  <select
                    value={filterEpochId}
                    onChange={(e) => setFilterEpochId(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Epochs</option>
                    {availableEpochs.map(id => (
                      <option key={id} value={id}>Epoch {id}</option>
                    ))}
                  </select>

                  {(filterTrainingId || filterEpochId) && (
                    <button
                      onClick={() => {
                        setFilterTrainingId('');
                        setFilterEpochId('');
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Trajectory List */}
                {loading ? (
                  <div className="text-center py-10 text-slate-500">Loading trajectories...</div>
                ) : trajectories.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    No trajectories found for this question.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trajectories.map((traj) => (
                      <div
                        key={traj.trajectory_id}
                        onClick={() => handleTrajectoryClick(traj.trajectory_id)}
                        className="bg-white rounded-lg p-4 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {traj.reward > 0 ? (
                              <CheckCircle2 size={18} className="text-green-500" />
                            ) : (
                              <XCircle size={18} className="text-red-500" />
                            )}
                            <div>
                              <div className="font-mono text-xs text-slate-500 mb-0.5">
                                {traj.trajectory_id}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-slate-700">
                                  {traj.training_id || 'N/A'}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="text-slate-600">
                                  Epoch {traj.epoch_id || 0}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="text-slate-600">
                                  Iter {traj.iteration_id || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className={`text-sm font-medium ${traj.reward > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Reward: {traj.reward?.toFixed(2) || '0.00'}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock size={12} />
                                {traj.exec_time?.toFixed(2) || '0.00'}s
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Trajectory Detail View */
            <div className="p-6">
              {detailLoading ? (
                <div className="text-center py-10 text-slate-500">Loading trajectory details...</div>
              ) : trajectoryDetail ? (
                <div className="space-y-6">
                  {/* Trajectory Header */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-sm text-slate-500">{trajectoryDetail.trajectory_id}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        trajectoryDetail.reward > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {trajectoryDetail.reward > 0 ? 'Success' : 'Failed'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Training</div>
                        <div className="font-medium text-slate-700 truncate">{trajectoryDetail.training_id || 'N/A'}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Epoch</div>
                        <div className="font-medium text-slate-700">{trajectoryDetail.epoch_id || 0}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Reward</div>
                        <div className={`font-medium ${trajectoryDetail.reward > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trajectoryDetail.reward?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">Exec Time</div>
                        <div className="font-medium text-slate-700">{trajectoryDetail.exec_time?.toFixed(2) || '0.00'}s</div>
                      </div>
                    </div>
                  </div>

                  {/* Agent Info */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Cpu size={16} className="text-blue-500" />
                      Agent Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">Agent Name</span>
                        <span className="font-medium">{trajectoryDetail.agent_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">Termination</span>
                        <span className="font-medium">{trajectoryDetail.termination_reason || '-'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">Iteration</span>
                        <span className="font-medium">{trajectoryDetail.iteration_id || 0}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">Sample ID</span>
                        <span className="font-medium">{trajectoryDetail.sample_id || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Task Context */}
                  {trajectoryDetail.task?.question && (
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
                      <h3 className="text-sm font-semibold text-blue-800 mb-2">Task Question</h3>
                      <p className="text-slate-700">{trajectoryDetail.task.question}</p>
                    </div>
                  )}

                  {/* Execution Flow */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Terminal size={16} className="text-blue-500" />
                        Execution Flow
                      </h3>
                    </div>
                    <div className="p-6 bg-slate-50/50 max-h-[500px] overflow-y-auto">
                      {trajectoryDetail.chat_completions && trajectoryDetail.chat_completions.length > 0 ? (
                        trajectoryDetail.chat_completions.map((msg: any, idx: number) => renderMessage(msg, idx))
                      ) : trajectoryDetail.steps && trajectoryDetail.steps.length > 0 ? (
                        trajectoryDetail.steps.map((step: any, idx: number) => renderStep(step, idx))
                      ) : (
                        <div className="text-center text-slate-400 py-10">No execution data found</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400">Failed to load trajectory details</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
