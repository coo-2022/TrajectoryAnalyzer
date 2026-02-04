/**
 * Excel风格列头筛选组件
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';

// 筛选器类型定义
export interface ColumnFilter {
  field: string;
  type: 'text' | 'options' | 'number' | 'boolean';
  active: boolean;
  value?: any;
  selected?: string[];
  conditions?: {
    equals?: number | null;
    greaterThan?: number | null;
    lessThan?: number | null;
  };
}

interface FilterPanelProps {
  column: {
    id: string;
    label: string;
    filterType: 'text' | 'options' | 'number' | 'boolean';
    options?: string[];
  };
  filter: ColumnFilter;
  onApply: (field: string, filter: ColumnFilter) => void;
  onClear: (field: string) => void;
  onClose: () => void;
}

// 文本筛选器
const TextFilter: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}> = ({ value, onChange, onApply, onClear }) => (
  <div className="p-3 min-w-[250px]">
    <input
      type="text"
      placeholder="Search..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      autoFocus
    />
    <div className="flex gap-2 mt-3">
      <button
        onClick={onApply}
        className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
      >
        OK
      </button>
      <button
        onClick={onClear}
        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
      >
        Clear
      </button>
    </div>
  </div>
);

// 选项筛选器（多选）
const OptionsFilter: React.FC<{
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onApply: () => void;
  onClear: () => void;
}> = ({ options, selected, onChange, onApply, onClear }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectAll, setSelectAll] = useState(selected.length === options.length);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter(s => s !== option)
      : [...selected, option];
    onChange(newSelected);
    setSelectAll(newSelected.length === options.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      onChange([]);
    } else {
      onChange(options);
    }
    setSelectAll(!selectAll);
  };

  return (
    <div className="p-3 min-w-[200px]">
      <input
        type="text"
        placeholder="Search options..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-2"
      />
      <div className="max-h-[200px] overflow-y-auto">
        <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={handleSelectAll}
            className="rounded"
          />
          <span className="text-sm font-medium">(Select All)</span>
        </label>
        {filteredOptions.map(option => (
          <label
            key={option}
            className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => handleToggle(option)}
              className="rounded"
            />
            <span className="text-sm">{option}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onApply}
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          OK
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

// 数值筛选器
const NumberFilter: React.FC<{
  conditions: ColumnFilter['conditions'];
  onChange: (conditions: ColumnFilter['conditions']) => void;
  onApply: () => void;
  onClear: () => void;
}> = ({ conditions, onChange, onApply, onClear }) => {
  const [useEquals, setUseEquals] = useState(conditions?.equals !== null && conditions?.equals !== undefined);
  const [useGreaterThan, setUseGreaterThan] = useState(conditions?.greaterThan !== null && conditions?.greaterThan !== undefined);
  const [useLessThan, setUseLessThan] = useState(conditions?.lessThan !== null && conditions?.lessThan !== undefined);

  return (
    <div className="p-3 min-w-[250px] space-y-2">
      <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded">
        <input
          type="checkbox"
          checked={useEquals}
          onChange={(e) => {
            setUseEquals(e.target.checked);
            if (!e.target.checked) {
              onChange({ ...conditions, equals: null });
            }
          }}
          className="rounded"
        />
        <span className="text-sm">Equals to:</span>
        {useEquals && (
          <input
            type="number"
            value={conditions?.equals ?? ''}
            onChange={(e) => onChange({ ...conditions, equals: parseFloat(e.target.value) || null })}
            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
          />
        )}
      </label>

      <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded">
        <input
          type="checkbox"
          checked={useGreaterThan}
          onChange={(e) => {
            setUseGreaterThan(e.target.checked);
            if (!e.target.checked) {
              onChange({ ...conditions, greaterThan: null });
            }
          }}
          className="rounded"
        />
        <span className="text-sm">Greater than:</span>
        {useGreaterThan && (
          <input
            type="number"
            value={conditions?.greaterThan ?? ''}
            onChange={(e) => onChange({ ...conditions, greaterThan: parseFloat(e.target.value) || null })}
            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
          />
        )}
      </label>

      <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded">
        <input
          type="checkbox"
          checked={useLessThan}
          onChange={(e) => {
            setUseLessThan(e.target.checked);
            if (!e.target.checked) {
              onChange({ ...conditions, lessThan: null });
            }
          }}
          className="rounded"
        />
        <span className="text-sm">Less than:</span>
        {useLessThan && (
          <input
            type="number"
            value={conditions?.lessThan ?? ''}
            onChange={(e) => onChange({ ...conditions, lessThan: parseFloat(e.target.value) || null })}
            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
          />
        )}
      </label>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onApply}
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          OK
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

// 主筛选面板组件
export const FilterPanel: React.FC<FilterPanelProps> = ({
  column,
  filter,
  onApply,
  onClear,
  onClose
}) => {
  const [localFilter, setLocalFilter] = useState<ColumnFilter>(filter);

  useEffect(() => {
    setLocalFilter(filter);
  }, [filter]);

  const handleApply = () => {
    onApply(column.id, { ...localFilter, active: true });
    onClose();
  };

  const handleClear = () => {
    onClear(column.id);
    onClose();
  };

  return (
    <div className="relative inline-block">
      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
        {column.filterType === 'text' && (
          <TextFilter
            value={localFilter.value || ''}
            onChange={(value) => setLocalFilter({ ...localFilter, value })}
            onApply={handleApply}
            onClear={handleClear}
          />
        )}

        {column.filterType === 'options' && column.options && (
          <OptionsFilter
            options={column.options}
            selected={localFilter.selected || []}
            onChange={(selected) => setLocalFilter({ ...localFilter, selected })}
            onApply={handleApply}
            onClear={handleClear}
          />
        )}

        {column.filterType === 'number' && (
          <NumberFilter
            conditions={localFilter.conditions || {}}
            onChange={(conditions) => setLocalFilter({ ...localFilter, conditions })}
            onApply={handleApply}
            onClear={handleClear}
          />
        )}
      </div>
    </div>
  );
};

// 列头组件（带筛选按钮）
export const ColumnHeader: React.FC<{
  column: {
    id: string;
    label: string;
    filterType: 'text' | 'options' | 'number' | 'boolean';
    options?: string[];
    sortable?: boolean;
  };
  filter: ColumnFilter;
  sortDirection?: 'asc' | 'desc' | null;
  onFilterToggle: (field: string) => void;
  onSort: (field: string) => void;
}> = ({ column, filter, sortDirection, onFilterToggle, onSort }) => {
  const [showFilter, setShowFilter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowFilter(false);
      }
    };

    if (showFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilter]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        {/* 排序按钮 */}
        {column.sortable && (
          <button
            onClick={() => onSort(column.id)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
          >
            {column.label}
            {sortDirection === 'asc' && <span>↑</span>}
            {sortDirection === 'desc' && <span>↓</span>}
            {!sortDirection && <span>↕</span>}
          </button>
        )}

        {!column.sortable && (
          <span className="text-xs font-semibold text-slate-600">{column.label}</span>
        )}

        {/* 筛选按钮 */}
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`p-1 rounded transition-colors ${
            filter.active
              ? 'bg-blue-100 text-blue-600'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
          title={filter.active ? 'Filter active' : 'Filter'}
        >
          {filter.active ? <Filter size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* 清除筛选按钮 */}
        {filter.active && (
          <button
            onClick={() => onFilterToggle(column.id)}
            className="p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Clear filter"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* 筛选面板 */}
      {showFilter && (
        <FilterPanel
          column={column}
          filter={filter}
          onApply={(_field, _newFilter) => {
            // This will be handled by parent
            setShowFilter(false);
          }}
          onClear={() => {
            // This will be handled by parent
            setShowFilter(false);
          }}
          onClose={() => setShowFilter(false)}
        />
      )}
    </div>
  );
};

export default FilterPanel;
