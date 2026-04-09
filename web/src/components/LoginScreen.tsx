import { useState, type KeyboardEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const trimmed = name.trim();
    if (!trimmed) { setError('请输入用户名'); return; }
    if (!password) { setError('请输入密码'); return; }

    if (isRegister) {
      if (password.length < 6) { setError('密码至少 6 位'); return; }
      if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register(trimmed, password);
      } else {
        await login(trimmed, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const switchMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm px-6 py-10 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col items-center gap-5">
        <h1 className="text-3xl font-bold text-slate-100 tracking-wide">MindX</h1>
        <p className="text-sm text-slate-400">
          {isRegister ? '创建新账号' : '登录你的账号'}
        </p>

        {error && (
          <div className="w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="用户名"
          autoFocus
          className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="密码"
          className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />

        {isRegister && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="确认密码"
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !name.trim() || !password}
          className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
        >
          {loading ? (isRegister ? '注册中…' : '登录中…') : (isRegister ? '注册' : '登录')}
        </button>

        <p className="text-sm text-slate-500">
          {isRegister ? '已有账号？' : '没有账号？'}
          <button
            onClick={switchMode}
            className="text-blue-400 hover:text-blue-300 ml-1 transition"
          >
            {isRegister ? '去登录' : '注册'}
          </button>
        </p>
      </div>
    </div>
  );
}
