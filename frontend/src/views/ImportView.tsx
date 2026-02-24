import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, Info, FolderOpen, Trash2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface ImportResult {
  success: boolean;
  message: string;
  trajectory_id?: string;
  task_id?: string;
  status?: string;
  error?: string;
  progress?: number;
  imported_count?: number;
  failed_count?: number;
  skipped_count?: number;
  warnings?: string[];
  errors?: string[];
}

interface ImportLog {
  timestamp: number;
  datetime: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  task_id: string;
  details: Record<string, any>;
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
  const [filePath, setFilePath] = useState('');
  const [importMethod, setImportMethod] = useState<'upload' | 'path'>('path');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [allowedDirectories, setAllowedDirectories] = useState<string[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载允许的目录
  const loadAllowedDirectories = async () => {
    try {
      const res = await fetch(`${API_BASE}/import/allowed-directories`);
      if (res.ok) {
        const data = await res.json();
        setAllowedDirectories(data.directories || []);
      }
    } catch (error) {
      console.error('Failed to load allowed directories:', error);
    }
  };

  useEffect(() => {
    loadAllowedDirectories();
  }, []);

  // Fetch logs for a specific task
  const fetchLogs = async (taskId: string) => {
    try {
      const res = await fetch(`${API_BASE}/import/logs/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  // Poll for import status updates
  useEffect(() => {
    if (!currentTaskId || !importing) return;

    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_BASE}/import/status/${currentTaskId}`);
        if (statusRes.ok) {
          const data = await statusRes.json();
          setResult(data);

          // Fetch logs periodically
          if (data.status === 'processing' || data.status === 'completed') {
            fetchLogs(currentTaskId);
          }

          // Stop polling if import is complete or failed
          if (data.status === 'completed' || data.status === 'failed') {
            setImporting(false);
            clearInterval(interval);
            // Final log fetch
            fetchLogs(currentTaskId);
          }
        }
      } catch (error) {
        console.error('Failed to poll status:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTaskId, importing]);

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
      if (droppedFile.type === "application/json" || droppedFile.name.endsWith('.json') || droppedFile.name.endsWith('.jsonl')) {
        setFile(droppedFile);
        setResult(null);
      } else {
        setResult({
          success: false,
          message: "请上传 JSON 或 JSONL 格式的文件",
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

  const handleUploadImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);
    setLogs([]);
    setShowLogs(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/import/json`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentTaskId(data.task_id || null);
        setResult({
          success: true,
          message: data.message || "导入中...",
          trajectory_id: data.trajectory_id,
          task_id: data.task_id,
          status: data.status || 'processing',
          progress: data.progress || 0
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
        setImporting(false);
      }
    } catch (error) {
      setResult({
        success: false,
        message: "网络错误，请检查后端服务",
        error: String(error)
      });
      setImporting(false);
    }
  };

  const handlePathImport = async () => {
    if (!filePath.trim()) return;

    setImporting(true);
    setResult(null);
    setLogs([]);
    setShowLogs(true);

    try {
      const response = await fetch(`${API_BASE}/import/from-path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_path: filePath,
          file_type: 'auto',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentTaskId(data.task_id || null);
        setResult({
          success: true,
          message: data.message || "导入中...",
          trajectory_id: data.trajectory_id,
          task_id: data.task_id,
          status: data.status || 'processing',
          progress: data.progress || 0
        });
        setFilePath('');
      } else {
        setResult({
          success: false,
          message: data.detail || "导入失败",
          error: data.detail
        });
        setImporting(false);
      }
    } catch (error) {
      setResult({
        success: false,
        message: "网络错误，请检查后端服务",
        error: String(error)
      });
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

  const handleClearData = async () => {
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE}/import/clear-data`, {
        method: 'POST'
      });
      if (res.ok) {
        setResult({ success: true, message: 'All data cleared successfully' });
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.detail || 'Failed to clear data' });
      }
    } catch (error) {
      setResult({ success: false, message: 'Error clearing data: ' + String(error) });
    }
    setClearing(false);
    setShowClearConfirm(false);
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

        {/* Import Method Selector */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setImportMethod('path')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              importMethod === 'path'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FolderOpen size={18} className="inline mr-2" />
            本地文件路径（推荐）
          </button>
          <button
            onClick={() => setImportMethod('upload')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              importMethod === 'upload'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Upload size={18} className="inline mr-2" />
            上传文件
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

      {/* Path-based Import (Recommended) */}
      {importMethod === 'path' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            本地文件路径导入
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              文件路径
            </label>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/home/user/Downloads/trajectories.json"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-2 text-sm text-slate-600">
              允许的目录：{allowedDirectories.length > 0 ? allowedDirectories.join(', ') : '加载中...'}
            </p>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700">
              <span className="font-medium">💡 自动格式识别：</span>
              系统会自动检测 JSON 或 JSONL 格式，无需手动选择
            </p>
          </div>

          <button
            onClick={handlePathImport}
            disabled={!filePath.trim() || importing}
            className={`w-full py-2.5 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
              importing || !filePath.trim()
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
                <FolderOpen className="w-4 h-4" />
                从路径导入
              </>
            )}
          </button>

          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-900">
                <p className="font-medium mb-1">优势</p>
                <ul className="space-y-1 text-green-700">
                  <li>✓ 无需网络传输</li>
                  <li>✓ 无需创建临时文件</li>
                  <li>✓ 直接读取原始文件</li>
                  <li>✓ 适合超大文件（几GB）</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload-based Import */}
      {importMethod === 'upload' && (
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
              accept=".json,.jsonl,application/json"
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
                  支持 JSON/JSONL 格式，最大 10GB
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
                    <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
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
                onClick={handleUploadImport}
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
                    开始上传
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-medium mb-1">注意</p>
                <p className="text-yellow-700">
                  上传方式会创建临时文件并进行网络传输，对于大文件建议使用"本地文件路径"方式。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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

              {/* Progress Bar */}
              {result.status === 'processing' && result.progress !== undefined && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>导入进度</span>
                    <span>{result.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${result.progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Statistics */}
              {(result.imported_count !== undefined || result.failed_count !== undefined || result.skipped_count !== undefined) && (
                <div className="flex gap-4 mb-2 text-xs">
                  {result.imported_count !== undefined && (
                    <span className="text-green-700 font-medium">
                      ✓ 成功: {result.imported_count}
                    </span>
                  )}
                  {result.failed_count !== undefined && result.failed_count > 0 && (
                    <span className="text-red-700 font-medium">
                      ✗ 失败: {result.failed_count}
                    </span>
                  )}
                  {result.skipped_count !== undefined && result.skipped_count > 0 && (
                    <span className="text-yellow-700 font-medium">
                      ⊘ 跳过: {result.skipped_count} (重复)
                    </span>
                  )}
                </div>
              )}

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs font-medium text-yellow-800 mb-1">
                    警告 ({result.warnings.length}):
                  </p>
                  <ul className="text-xs text-yellow-700 space-y-0.5">
                    {result.warnings.slice(0, 5).map((warning, idx) => (
                      <li key={idx} className="truncate">• {warning}</li>
                    ))}
                    {result.warnings.length > 5 && (
                      <li className="text-yellow-600 italic">
                        ... 还有 {result.warnings.length - 5} 条警告
                      </li>
                    )}
                  </ul>
                </div>
              )}

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

      {/* Import Logs */}
      {showLogs && logs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">导入日志</h3>
            <button
              onClick={() => setShowLogs(false)}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              关闭
            </button>
          </div>

          <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={idx} className="mb-2 last:mb-0">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                    {log.datetime}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    log.level === 'error'
                      ? 'bg-red-900 text-red-300'
                      : log.level === 'warning'
                      ? 'bg-yellow-900 text-yellow-300'
                      : 'bg-blue-900 text-blue-300'
                  }`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-200">{log.message}</span>
                </div>
                {Object.keys(log.details).length > 0 && (
                  <div className="ml-6 mt-1 text-xs text-slate-400 font-mono">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                )}
              </div>
            ))}
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
              <li>• 支持 JSON 和 JSONL 格式，系统自动识别</li>
              <li>• JSON: 标准数组或对象格式</li>
              <li>• JSONL: 每行一个 JSON 对象，推荐用于超大文件</li>
              <li>• 本地路径导入无需拷贝文件，直接读取</li>
              <li>• 导入后可在 <strong>Trajectories</strong> 页面查看数据</li>
              <li>• 重复的 trajectory_id 会被跳过</li>
              <li>• steps_json 可以是空数组，但至少要有基本信息</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Clear Data Section */}
      <div className="mt-8 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          清除系统数据
        </h3>
        <p className="text-slate-600 text-sm mb-4">
          删除所有轨迹和分析数据以重新开始。
          此操作无法撤销。
        </p>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          清除所有数据
        </button>
      </div>

      {/* Clear Data Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              确认清除数据
            </h3>
            <p className="text-slate-600 mb-4">
              这将永久删除所有轨迹和分析数据。
              此操作无法撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:bg-rose-400"
              >
                {clearing ? '清除中...' : '确认清除所有数据'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
