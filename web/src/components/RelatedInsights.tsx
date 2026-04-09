import { useState, useEffect } from 'react';
import { api, type Insight } from '../lib/api';
import InsightCard from './InsightCard';

interface RelatedInsightsProps {
  sourceType: 'document' | 'note';
  sourceId: number;
  refreshKey?: number;
}

export default function RelatedInsights({ sourceType, sourceId, refreshKey }: RelatedInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const title = sourceType === 'note' ? '从此笔记萃取的洞察' : '从此文档萃取的洞察';

  const reload = async () => {
    setLoading(true);
    try {
      const data = await api.listInsights({ source_type: sourceType, source_id: sourceId });
      setInsights(data);
    } catch (err) {
      console.error('加载相关洞察失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [sourceId, refreshKey]);

  return (
    <div className="bg-slate-900 text-slate-200 rounded-xl border border-slate-700 p-4">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>

      {loading ? (
        <p className="text-slate-500 text-center py-8">加载中…</p>
      ) : insights.length === 0 ? (
        <p className="text-slate-500 text-center py-8 text-sm">
          暂无洞察，点击上方「萃取洞察」生成
        </p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              hideSource
              onUpdate={() => reload()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
