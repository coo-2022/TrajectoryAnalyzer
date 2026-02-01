import { useEffect, useState } from 'react';
import { AlertCircle, Clock, XCircle, Filter, CheckCircle, Minus } from 'lucide-react';

interface ToolContext {
  trajectory_id: string;
  step_id: number;
  action: string;
  observation: string;
  category: 'empty' | 'timeout' | 'connection_error';
  context: {
    question: string;
    step_number: number;
  };
}

interface UnexpectedToolContextsResponse {
  total: number;
  data: ToolContext[];
}

const CATEGORY_CONFIG = {
  empty: {
    label: 'Empty',
    icon: Minus,
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200'
  },
  timeout: {
    label: 'Timeout',
    icon: Clock,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200'
  },
  connection_error: {
    label: 'Connection Error',
    icon: XCircle,
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200'
  }
};

export default function UnexpectedToolContextsView() {
  const [data, setData] = useState<UnexpectedToolContextsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadData();
  }, [selectedCategory, limit]);

  const loadData = () => {
    setLoading(true);
    const categoryParam = selectedCategory === 'all' ? '' : `&category=${selectedCategory}`;
    fetch(`/api/analysis-stats/unexpected-tool-contexts?limit=${limit}${categoryParam}`)
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch unexpected tool contexts:', err);
        setLoading(false);
      });
  };

  if (loading && !data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Unexpected Tool Returns</h3>
        <div className="animate-pulse h-48 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Unexpected Tool Returns</h3>
        <p className="text-slate-500">Failed to load data</p>
      </div>
    );
  }

  const filteredData = data.data;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-slate-800">Unexpected Tool Returns</h3>
          <span className="text-sm text-slate-500">({filteredData.length} found)</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="empty">Empty</option>
            <option value="timeout">Timeout</option>
            <option value="connection_error">Connection Error</option>
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-slate-600">No unexpected tool returns found</p>
          <p className="text-sm text-slate-400 mt-1">All tool calls returned normally</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Trajectory</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Step</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Observation</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Question</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => {
                const config = CATEGORY_CONFIG[item.category];
                const Icon = config.icon;

                return (
                  <tr key={index} className={`border-b border-slate-100 hover:bg-slate-50 ${config.bgColor}`}>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-blue-600">
                        {item.trajectory_id}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">#{item.step_id}</td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-slate-700">{item.action || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {config.label}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="max-w-xs text-sm text-slate-600 truncate" title={item.observation}>
                        {item.observation || '(empty)'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="max-w-xs text-xs text-slate-500 truncate" title={item.context.question}>
                        {item.context.question}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
