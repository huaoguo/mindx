import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Note } from '../lib/api';
import RelatedInsights from './RelatedInsights';

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractKey, setExtractKey] = useState(0);

  useEffect(() => {
    if (id) loadNote(id);
  }, [id]);

  async function loadNote(noteId: string) {
    setLoading(true);
    try {
      const data = await api.getNote(Number(noteId));
      setNote(data);
    } catch (e) {
      console.error('Failed to load note', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    if (!id) return;
    setExtracting(true);
    try {
      const result = await api.extractInsights('note', Number(id));
      alert(`萃取完成：新增 ${result.stats.added ?? 0} 条洞察，更新 ${result.stats.updated ?? 0} 条洞察`);
      setExtractKey((k) => k + 1);
    } catch (e) {
      console.error('Failed to extract insights', e);
      alert('萃取洞察失败');
    } finally {
      setExtracting(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('确定要删除这条笔记吗？')) return;
    try {
      await api.deleteNote(Number(id));
      navigate('/notes');
    } catch (e) {
      console.error('Failed to delete note', e);
      alert('删除失败');
    }
  }

  function handleEdit() {
    if (!note) return;
    navigate('/notes', {
      state: {
        editId: note.id,
        editTitle: note.title,
        editContent: note.content,
      },
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">
        <span className="text-slate-400">加载中...</span>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">
        <span className="text-slate-400">笔记不存在</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      {/* Toolbar */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/notes')}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          ← 返回
        </button>
        <div className="flex-1" />
        <button
          onClick={handleEdit}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded px-4 py-1.5 text-sm transition-colors"
        >
          编辑
        </button>
        <button
          onClick={handleExtract}
          disabled={extracting}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded px-4 py-1.5 text-sm transition-colors"
        >
          {extracting ? '萃取中...' : '萃取洞察'}
        </button>
        <button
          onClick={handleDelete}
          className="bg-red-600 hover:bg-red-700 text-white rounded px-4 py-1.5 text-sm transition-colors"
        >
          删除
        </button>
      </div>

      {/* Two-column layout */}
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* Left: Note content */}
        <div className="flex-1 bg-slate-800 rounded-lg p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-slate-100 mb-3">{note.title}</h1>
          <div className="text-sm text-slate-400 mb-6">
            创建者 {note.created_by ?? '未知'}
            {' · '}
            编辑者 {note.updated_by ?? '未知'}
            {' · '}
            创建于 {new Date(note.created_at).toLocaleString('zh-CN')}
            {note.updated_at && note.updated_at !== note.created_at && (
              <> · 更新于 {new Date(note.updated_at).toLocaleString('zh-CN')}</>
            )}
          </div>
          <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
            {note.content || '（无内容）'}
          </div>
        </div>

        {/* Right: Related Insights */}
        <div className="w-full lg:w-80 shrink-0">
          <RelatedInsights sourceType="note" sourceId={Number(id!)} key={extractKey} />
        </div>
      </div>
    </div>
  );
}
