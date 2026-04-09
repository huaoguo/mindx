import { useState, type KeyboardEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await login(trimmed);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm px-6 py-10 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-slate-100 tracking-wide">MindX</h1>
        <p className="text-sm text-slate-400">输入你的名字以继续</p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="你的名字"
          autoFocus
          className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />

        <button
          onClick={handleLogin}
          disabled={loading || !name.trim()}
          className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </div>
    </div>
  );
}
