import { useState, useEffect, useCallback } from 'react';
import { api, type Insight } from '../lib/api';
import InsightCard from './InsightCard';

const CATEGORIES = [
  { value: '', label: '全部分类' },
  { value: 'goal', label: '目标' },
  { value: 'preference', label: '偏好' },
  { value: 'fact', label: '事实' },
  { value: 'constraint', label: '约束' },
  { value: 'decision', label: '决策' },
  { value: 'insight', label: '洞见' },
  { value: 'relationship', label: '关系' },
  { value: 'event', label: '事件' },
];

const STATUSES = [
  { value: '', label: '有效' },
  { value: 'confirmed', label: '已确认' },
  { value: 'pending', label: '待确认' },
  { value: 'deprecated', label: '已废弃' },
];

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const filters: { status?: string; category?: string; pinned?: boolean } = {};
      if (category) filters.category = category;
      if (status) filters.status = status;
      if (pinnedOnly) filters.pinned = true;
      const data = await api.listInsights(filters);
      setInsights(data);
    } catch (err) {
      console.error('加载洞察失败', err);
    } finally {
      setLoading(false);
    }
  }, [category, status, pinnedOnly]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <h1 className="text-2xl font-bold mb-6">洞察</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setPinnedOnly((v) => !v)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pinnedOnly
              ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
          }`}
        >
          仅看置顶
        </button>
      </div>

      {/* Insight list */}
      {loading ? (
        <p className="text-slate-500 text-center py-12">加载中…</p>
      ) : insights.length === 0 ? (
        <p className="text-slate-500 text-center py-12">
          还没有洞察。你可以从文档或笔记中萃取洞察。
        </p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onUpdate={() => reload()} />
          ))}
        </div>
      )}
    </div>
  );
}
