import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Doc } from '../lib/api';
import RelatedInsights from './RelatedInsights';

const TYPE_LABELS: Record<string, string> = {
  user: '用户文档',
  soul: '人格设定',
  memory: '记忆',
  log: '日志',
  chat: '对话',
};

export default function DocDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractKey, setExtractKey] = useState(0);

  useEffect(() => {
    if (id) loadDoc(id);
  }, [id]);

  async function loadDoc(docId: string) {
    setLoading(true);
    try {
      const data = await api.getDoc(Number(docId));
      setDoc(data);
    } catch (e) {
      console.error('Failed to load doc', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    if (!id) return;
    setExtracting(true);
    try {
      const result = await api.extractInsights('document', Number(id));
      alert(`萃取完成：新增 ${result.stats.added ?? 0} 条洞察，更新 ${result.stats.updated ?? 0} 条洞察`);
      setExtractKey((k) => k + 1);
    } catch (e) {
      console.error('Failed to extract insights', e);
      alert('萃取洞察失败');
    } finally {
      setExtracting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">
        <span className="text-slate-400">加载中...</span>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">
        <span className="text-slate-400">文档不存在</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      {/* Toolbar */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/docs')}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← 返回
        </button>
        <div className="flex-1" />
        <button
          onClick={handleExtract}
          disabled={extracting}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded px-4 py-1.5 text-sm transition-colors"
        >
          {extracting ? '萃取中...' : '萃取洞察'}
        </button>
      </div>

      {/* Two-column layout */}
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Left: Doc content */}
        <div className="flex-1 bg-slate-800 rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-slate-100 mb-3">{doc.filename}</h1>
          <div className="text-sm text-slate-400 mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs bg-purple-600/30 text-purple-300 rounded px-2 py-0.5">
              {TYPE_LABELS[doc.type] ?? doc.type}
            </span>
            <span>来自 {doc.agent_name ?? '未知'}</span>
            {doc.file_created_at && (
              <span>· 文件创建于 {new Date(doc.file_created_at).toLocaleString('zh-CN')}</span>
            )}
            <span>· 上传于 {new Date(doc.uploaded_at).toLocaleString('zh-CN')}</span>
          </div>
          <pre className="text-slate-200 whitespace-pre-wrap font-mono text-sm leading-relaxed rounded p-4 bg-slate-900/50">
            {doc.content || '（无内容）'}
          </pre>
        </div>

        {/* Right: Related Insights */}
        <div className="w-full lg:w-80 shrink-0">
          <RelatedInsights sourceType="document" sourceId={Number(id!)} key={extractKey} />
        </div>
      </div>
    </div>
  );
}
