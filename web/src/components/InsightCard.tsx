import { useNavigate } from 'react-router-dom';
import { api, type Insight } from '../lib/api';

const categoryLabels: Record<Insight['category'], string> = {
  preference: '偏好',
  fact: '事实',
  constraint: '约束',
  decision: '决策',
  goal: '目标',
  insight: '洞见',
  relationship: '关系',
  event: '事件',
};

const sourceTypeLabels: Record<Insight['source_type'], string> = {
  document: '文档',
  note: '笔记',
};

interface Props {
  insight: Insight;
  hideSource?: boolean;
  onUpdate?: () => void;
}

export default function InsightCard({ insight, hideSource, onUpdate }: Props) {
  const navigate = useNavigate();

  const borderColor = insight.pinned
    ? 'border-yellow-500/60'
    : insight.status === 'pending'
      ? 'border-orange-500/60'
      : 'border-slate-700';

  const sourcePath =
    insight.source_type === 'document'
      ? `/docs/${insight.source_id}`
      : `/notes/${insight.source_id}`;

  const handlePin = async () => {
    try {
      await api.updateInsight(insight.id, { pinned: !insight.pinned });
      onUpdate?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleConfirm = async () => {
    try {
      await api.updateInsight(insight.id, { status: 'confirmed' });
      onUpdate?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这条洞察吗？')) return;
    try {
      await api.deleteInsight(insight.id);
      onUpdate?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className={`rounded-xl border ${borderColor} bg-slate-900 p-4 flex flex-col gap-3`}>
      {/* Content */}
      <p className="text-sm font-bold text-slate-100 leading-relaxed">{insight.content}</p>
      {insight.value_summary && (
        <p className="text-xs text-slate-400 leading-relaxed">{insight.value_summary}</p>
      )}

      {/* Source line */}
      {!hideSource && (
        <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
          {insight.source_quote && (
            <>
              <span className="italic">&ldquo;{insight.source_quote}&rdquo;</span>
              <span>&middot;</span>
            </>
          )}
          {insight.source_position && (
            <>
              <span>{insight.source_position}</span>
              <span>&middot;</span>
            </>
          )}
          <button
            onClick={() => navigate(sourcePath)}
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition"
          >
            {sourceTypeLabels[insight.source_type]}
            {insight.source_name ? `：${insight.source_name}` : `#${insight.source_id}`}
          </button>
          {insight.source_timestamp && (
            <>
              <span>&middot;</span>
              <span>{formatDate(insight.source_timestamp)}</span>
            </>
          )}
        </p>
      )}

      {/* Badges + Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
            {categoryLabels[insight.category]}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              insight.confidence < 60
                ? 'bg-orange-500/20 text-orange-300'
                : 'bg-green-500/20 text-green-300'
            }`}
          >
            {insight.confidence}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePin}
            className="text-xs text-slate-400 hover:text-yellow-400 transition"
          >
            {insight.pinned ? '取消置顶' : '置顶'}
          </button>
          {insight.status === 'pending' && (
            <button
              onClick={handleConfirm}
              className="text-xs text-slate-400 hover:text-green-400 transition"
            >
              确认
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-xs text-slate-400 hover:text-red-400 transition"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
