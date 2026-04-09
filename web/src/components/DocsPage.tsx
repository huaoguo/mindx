import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Doc } from '../lib/api';

const TYPE_LABELS: Record<string, string> = {
  user: '用户文档',
  soul: '人格设定',
  memory: '记忆',
  log: '日志',
  chat: '对话',
};

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'user', label: '用户文档' },
  { value: 'soul', label: '人格设定' },
  { value: 'memory', label: '记忆' },
  { value: 'log', label: '日志' },
  { value: 'chat', label: '对话' },
];

export default function DocsPage() {
  const navigate = useNavigate();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [insightCounts, setInsightCounts] = useState<Record<number, number>>({});
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDocs();
  }, [typeFilter]);

  async function loadDocs() {
    setLoading(true);
    try {
      const [data, insights] = await Promise.all([
        api.listDocs(typeFilter || undefined),
        api.listInsights({ source_type: 'document' }),
      ]);
      setDocs(data);
      const counts: Record<number, number> = {};
      for (const ins of insights) {
        counts[ins.source_id] = (counts[ins.source_id] || 0) + 1;
      }
      setInsightCounts(counts);
    } catch (e) {
      console.error('Failed to load docs', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      {/* Filter bar */}
      <div className="max-w-3xl mx-auto mb-6">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-700 text-slate-200 rounded px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Docs list */}
      <div className="max-w-3xl mx-auto space-y-3">
        {loading && docs.length === 0 && (
          <div className="text-center text-slate-500 py-12">加载中...</div>
        )}
        {docs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => navigate(`/docs/${doc.id}`)}
            className="bg-slate-800 hover:bg-slate-750 hover:ring-1 hover:ring-blue-500/40 rounded-lg p-4 cursor-pointer transition-all shadow"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-100">{doc.filename}</span>
              <span className="text-xs bg-purple-600/30 text-purple-300 rounded px-2 py-0.5">
                {TYPE_LABELS[doc.type] ?? doc.type}
              </span>
              {insightCounts[doc.id] > 0 && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5">
                  {insightCounts[doc.id]} 条洞察
                </span>
              )}
            </div>
            <div className="text-sm text-slate-400">
              来自 {doc.agent_name ?? '未知'}
              {' · '}
              {new Date(doc.uploaded_at).toLocaleString('zh-CN')}
            </div>
          </div>
        ))}
        {!loading && docs.length === 0 && (
          <div className="text-center text-slate-500 py-12">暂无文档</div>
        )}
      </div>
    </div>
  );
}
