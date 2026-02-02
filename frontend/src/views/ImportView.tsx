import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, Info } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface ImportResult {
  success: boolean;
  message: string;
  trajectory_id?: string;
  task_id?: string;
  status?: string;
  error?: string;
}

interface TemplateExample {
  trajectory_id: string;
  session_id: string;
  task: {
    question: string;
    category?: string;
  };
  reward: number;
  termination_reason: string;
  steps_json: Array<{
    step_id: number;
    role: string;
    action: string;
    observation: string;
    reward: number;
    chat_history?: string;
  }>;
  training_metadata?: {
    epoch_id?: number;
    iteration_id?: number;
    sample_id?: number;
    training_id?: string;
  };
}

export default function ImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/json" || droppedFile.name.endsWith('.json')) {
        setFile(droppedFile);
        setResult(null);
      } else {
        setResult({
          success: false,
          message: "请上传 JSON 格式的文件",
          error: "Invalid file format"
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/import/json`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || "导入成功",
          trajectory_id: data.trajectory_id,
          task_id: data.task_id,
          status: data.status
        });
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setResult({
          success: false,
          message: data.detail || "导入失败",
          error: data.detail
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "网络错误，请检查后端服务",
        error: String(error)
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template: TemplateExample = {
      trajectory_id: "example_001",
      session_id: "session_20250201_001",
      task: {
        question: "用户提出的问题示例",
        category: "general"
      },
      reward: 1.0,
      termination_reason: "success",
      steps_json: [
        {
          step_id: 1,
          role: "assistant",
          action: "tool_search",
          observation: "工具执行结果",
          reward: 0.5,
          chat_history: "对话历史"
        },
        {
          step_id: 2,
          role: "assistant",
          action: "tool_execute",
          observation: "执行成功",
          reward: 0.5,
          chat_history: "完成对话"
        }
      ],
      training_metadata: {
        epoch_id: 1,
        iteration_id: 2,
        sample_id: 3,
        training_id: "train_001"
      }
    };

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trajectory_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">导入轨迹数据</h2>
            <p className="text-sm text-slate-600">
              上传 JSON 格式的轨迹文件，系统会自动解析并存储到数据库
            </p>
          </div>
          <button
            onClick={() => setShowTemplate(!showTemplate)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Info size={16} />
            {showTemplate ? '隐藏格式说明' : '查看格式说明'}
          </button>
        </div>

        {/* Format Reference */}
        {showTemplate && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">JSON 数据格式</h3>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Download size={14} />
                下载模板
              </button>
            </div>
            <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-x-auto">
{`{
  "trajectory_id": "唯一标识符",
  "session_id": "会话ID",
  "task": {
    "question": "用户问题",
    "category": "问题分类（可选）"
  },
  "reward": 1.0,
  "termination_reason": "success/timeout/error",
  "steps_json": [
    {
      "step_id": 1,
      "role": "assistant",
      "action": "工具名称",
      "observation": "执行结果",
      "reward": 0.5,
      "chat_history": "对话内容（可选）"
    }
  ],
  "training_metadata": {
    "epoch_id": 1,
    "iteration_id": 2,
    "sample_id": 3,
    "training_id": "train_001"
  }
}`}
            </pre>
            <div className="mt-3 text-xs text-slate-600">
              <p><strong>必填字段：</strong> trajectory_id, session_id, task.question, reward, termination_reason, steps_json</p>
              <p className="mt-1"><strong>可选字段：</strong> task.category, training_metadata, chat_history</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div
          className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-slate-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                dragActive ? 'bg-blue-100' : 'bg-slate-100'
              }`}>
                <Upload className={`w-8 h-8 ${dragActive ? 'text-blue-600' : 'text-slate-600'}`} />
              </div>
              <p className="text-lg font-medium text-slate-900 mb-2">
                {file ? file.name : "拖拽文件到此处或点击上传"}
              </p>
              <p className="text-sm text-slate-500">
                支持 JSON 格式，最大 10MB
              </p>
            </div>
          </label>
        </div>

        {/* File Info & Actions */}
        {file && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{file.name}</p>
                  <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="text-sm text-slate-600 hover:text-red-600 transition-colors"
              >
                移除
              </button>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className={`mt-4 w-full py-2.5 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                importing
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  开始导入
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Import Result */}
      {result && (
        <div className={`rounded-lg shadow-sm p-6 border ${
          result.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              result.success ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold mb-1 ${
                result.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {result.success ? '导入成功' : '导入失败'}
              </h3>
              <p className={`text-sm mb-2 ${
                result.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {result.message}
              </p>
              {result.trajectory_id && (
                <p className="text-xs text-green-600 font-mono">
                  轨迹ID: {result.trajectory_id}
                </p>
              )}
              {result.task_id && (
                <p className="text-xs text-slate-600">
                  任务ID: {result.task_id}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">提示</p>
            <ul className="space-y-1 text-blue-700">
              <li>• 支持单文件导入和批量导入（JSONL 格式）</li>
              <li>• 导入后可在 <strong>Trajectories</strong> 页面查看数据</li>
              <li>• 重复的 trajectory_id 会被更新而不是覆盖</li>
              <li>• steps_json 可以是空数组，但至少要有基本信息</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
