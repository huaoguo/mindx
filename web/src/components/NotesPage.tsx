import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, type Note } from '../lib/api';

export default function NotesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    const state = location.state as { editId?: number; editTitle?: string; editContent?: string } | null;
    if (state?.editId) {
      setEditingId(state.editId);
      setTitle(state.editTitle ?? '');
      setContent(state.editContent ?? '');
      // Clear the location state so refreshing doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  async function loadNotes() {
    try {
      const data = await api.listNotes();
      setNotes(data);
    } catch (e) {
      console.error('Failed to load notes', e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      alert('标题不能为空');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await api.updateNote(editingId, { title: title.trim(), content: content.trim() });
      } else {
        await api.createNote({ title: title.trim(), content: content.trim() });
      }
      clearForm();
      await loadNotes();
    } catch (e) {
      console.error('Failed to save note', e);
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setTitle('');
    setContent('');
    setEditingId(null);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      {/* Create / Edit Form */}
      <div className="max-w-3xl mx-auto mb-8 bg-slate-800 rounded-lg p-6 shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题"
            className="w-full bg-slate-700 text-slate-200 placeholder-slate-400 rounded px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="内容（可选）"
            rows={4}
            className="w-full bg-slate-700 text-slate-200 placeholder-slate-400 rounded px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded px-5 py-2 transition-colors"
            >
              {editingId ? '更新' : '添加笔记'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={clearForm}
                className="bg-slate-600 hover:bg-slate-500 text-slate-200 font-medium rounded px-5 py-2 transition-colors"
              >
                取消
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Notes List */}
      <div className="max-w-3xl mx-auto space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            onClick={() => navigate(`/notes/${note.id}`)}
            className="bg-slate-800 hover:bg-slate-750 hover:ring-1 hover:ring-blue-500/40 rounded-lg p-4 cursor-pointer transition-all shadow"
          >
            <div className="font-bold text-slate-100 mb-1">{note.title}</div>
            <div className="text-sm text-slate-400">
              创建者 {note.created_by ?? '未知'}
              {' · '}
              编辑者 {note.updated_by ?? '未知'}
              {' · '}
              {new Date(note.updated_at ?? note.created_at).toLocaleString('zh-CN')}
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-center text-slate-500 py-12">暂无笔记</div>
        )}
      </div>
    </div>
  );
}
