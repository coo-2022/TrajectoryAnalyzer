import React, { useState } from 'react';

interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ current, total, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  if (total === 0) return null;

  const handleJump = () => {
    const page = parseInt(inputValue);
    if (isNaN(page) || page < 1 || page > totalPages) {
      setError(`请输入 1-${totalPages} 之间的页码`);
      return;
    }
    setError('');
    setInputValue('');
    onChange(page);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJump();
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, current - 1))}
          disabled={current === 1}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50"
        >
          Prev
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, current + 1))}
          disabled={current === totalPages}
          className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-slate-50"
        >
          Next
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-500">{current} / {totalPages} 页</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">共 <span className="font-medium text-slate-700">{total.toLocaleString()}</span> 条</span>

        {/* 跳转输入框 */}
        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
          <span className="text-slate-500">跳转</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError('');
            }}
            onKeyPress={handleKeyPress}
            placeholder={`1-${totalPages}`}
            className={`w-20 px-2 py-1 border rounded text-sm text-center ${
              error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
            } focus:outline-none focus:ring-2`}
          />
          <button
            onClick={handleJump}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={!inputValue}
          >
            GO
          </button>
          {error && <span className="text-xs text-red-500 whitespace-nowrap">{error}</span>}
        </div>
      </div>
    </div>
  );
};
