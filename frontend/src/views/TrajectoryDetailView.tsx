import React, { useState, useEffect } from 'react';
import { ArrowLeft, Cpu, Target, Clock, Box, User, Bot, Terminal, Loader2 } from 'lucide-react';
import { ResultBadge } from '../components/common';

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

  async getTrajectoryDetail(id: string) {
    const encodedId = encodeURIComponent(id);
    const data = await this.fetchJSON(`/trajectories/${encodedId}`);
    return data;
  }
}

const backend = new APIBackend();

// ==========================================
// Types
// ==========================================

interface TrajectoryDetailViewProps {
  trajectoryId: string;
  onBack: () => void;
}

// ==========================================
// Component
// ==========================================

export const TrajectoryDetailView: React.FC<TrajectoryDetailViewProps> = ({ trajectoryId, onBack }) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend.getTrajectoryDetail(trajectoryId)
      .then(res => {
        if (!res) setError("Failed to load trajectory");
        else setData(res);
      });
  }, [trajectoryId]);

  if (error) return (
    <div className="p-10 text-center text-red-500">
      {error} <button onClick={onBack} className="ml-4 underline">Back</button>
    </div>
  );

  if (!data) return (
    <div className="p-10 text-center text-slate-500 flex items-center justify-center min-h-[300px]">
      <Loader2 className="animate-spin mr-2"/> Loading details...
    </div>
  );

  const renderMessage = (msg: any, idx: number) => {
    let roleColor = "bg-gray-100 border-gray-200";
    let RoleIcon = User;

    if (msg.role === 'user') {
      roleColor = "bg-blue-50 border-blue-100";
      RoleIcon = User;
    } else if (msg.role === 'assistant') {
      roleColor = "bg-white border-slate-200";
      RoleIcon = Bot;
    } else if (msg.role === 'tool') {
      roleColor = "bg-purple-50 border-purple-100";
      RoleIcon = Terminal;
    }

    const formatContent = (content: any) => {
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      return <div className="whitespace-pre-wrap font-mono text-sm text-slate-700">{contentStr}</div>;
    };

    return (
      <div key={idx} className={`flex gap-4 p-4 mb-3 rounded-lg border ${roleColor}`}>
        <div className={`mt-1 p-1.5 rounded-full h-fit ${
          msg.role === 'user' ? 'bg-blue-100 text-blue-600' :
          msg.role === 'tool' ? 'bg-purple-100 text-purple-600' :
          'bg-slate-100 text-slate-600'
        }`}>
          <RoleIcon size={16} />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center mb-1">
            <span className="text-xs font-bold uppercase text-slate-500 mr-2">{msg.role}</span>
          </div>
          {formatContent(msg.content)}
        </div>
      </div>
    );
  };

  const renderStep = (step: any, idx: number) => {
    return (
      <div key={idx} className="flex gap-4 p-4 mb-3 rounded-lg border bg-slate-50 border-slate-200">
        <div className="mt-1 p-1.5 rounded-full h-fit bg-blue-100 text-blue-600">
          <Terminal size={16} />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center mb-2">
            <span className="text-xs font-bold uppercase text-slate-500 mr-2">Step {step.step_id}</span>
            {step.action && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                {step.action}
              </span>
            )}
          </div>

          {step.thought && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-slate-500 mb-1">Thought:</div>
              <div className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200">
                {step.thought}
              </div>
            </div>
          )}

          {step.model_response && (
            <div className="mb-2">
              <div className="text-xs font-semibold text-slate-500 mb-1">Response:</div>
              <div className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200">
                {step.model_response}
              </div>
            </div>
          )}

          {step.observation && (
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Observation:</div>
              <div className="text-sm text-slate-700 bg-green-50 p-2 rounded border border-green-200">
                {step.observation}
              </div>
            </div>
          )}

          {step.done && (
            <div className="mt-2">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                ✓ Completed
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={20} className="mr-1"/> <span className="font-medium">Back to List</span>
        </button>
        <div className="flex-1"></div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-mono mb-1">{data.trajectory_id}</div>
          <ResultBadge success={data.isSuccess} />
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center">
            <Cpu size={14} className="mr-1"/> Agent Info
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Name:</span>
              <span className="font-mono">{data.agent_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Epoch:</span>
              <span className="font-mono">{data.epoch_id || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Train ID:</span>
              <span className="font-mono truncate w-20" title={data.training_id}>
                {data.training_id || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center">
            <Target size={14} className="mr-1"/> Metrics
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Final Reward:</span>
              <span className={`font-mono font-bold ${data.reward > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(data.reward || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tool Reward:</span>
              <span className="font-mono">{(data.toolcall_reward || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Res Reward:</span>
              <span className="font-mono">{(data.res_reward || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center">
            <Clock size={14} className="mr-1"/> Execution
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Time:</span>
              <span className="font-mono">{(data.exec_time || 0).toFixed(2)}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reason:</span>
              <span className="font-mono">{data.termination_reason || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Data ID:</span>
              <span className="font-mono">{data.data_id || data.questionId || "-"}</span>
            </div>
          </div>
        </div>

        <div className="col-span-1 bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
          <h4 className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center">
            <Box size={14} className="mr-1"/> Task Context
          </h4>
          <div className="text-sm text-slate-700 font-medium line-clamp-3" title={data.task?.question}>
            Q: {data.task?.question || "No Question Text"}
          </div>
        </div>
      </div>

      {/* Chat Flow Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-800">Execution Flow (Chat History)</h3>
        </div>
        <div className="p-6 bg-slate-50/50 min-h-[400px]">
          {data.chat_completions && data.chat_completions.length > 0 ? (
            data.chat_completions.map((msg: any, idx: number) => renderMessage(msg, idx))
          ) : data.steps && data.steps.length > 0 ? (
            data.steps.map((step: any, idx: number) => renderStep(step, idx))
          ) : (
            <div className="text-center text-slate-400 py-10">No execution data found</div>
          )}
        </div>
      </div>
    </div>
  );
};
