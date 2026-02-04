import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  delta?: string; // "+5.3%" or "-2.1%" or "0"
  color?: 'blue' | 'emerald' | 'rose' | 'amber';
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    icon: 'text-blue-500'
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    icon: 'text-emerald-500'
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    icon: 'text-rose-500'
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    icon: 'text-amber-500'
  }
};

export default function MetricCard({
  title,
  value,
  delta,
  color = 'blue'
}: MetricCardProps) {
  const colors = colorClasses[color];
  const deltaNum = delta ? parseFloat(delta) : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>

        {delta !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${colors.bg}`}>
            {deltaNum > 0 ? (
              <TrendingUp className={`w-4 h-4 ${colors.icon}`} />
            ) : deltaNum < 0 ? (
              <TrendingDown className={`w-4 h-4 ${colors.icon}`} />
            ) : (
              <Minus className={`w-4 h-4 ${colors.icon}`} />
            )}
            <span className={`text-sm font-semibold ${colors.text}`}>
              {deltaNum > 0 ? '+' : ''}{delta}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
