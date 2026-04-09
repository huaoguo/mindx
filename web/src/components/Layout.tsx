import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const tabs = [
  { label: '笔记', to: '/notes' },
  { label: '文档', to: '/docs' },
  { label: '洞察', to: '/insights' },
  { label: 'Agent', to: '/agents' },
] as const;

export default function Layout() {
  const { user, logout } = useAuth();
  const isNoteDetail = useMatch('/notes/:id');
  const isDocDetail = useMatch('/docs/:id');
  const isDetailPage = !!(isNoteDetail || isDocDetail);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-100 tracking-tight">
            MindX
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-400">{user?.name}</span>
            <button
              onClick={logout}
              className="rounded px-2.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="bg-slate-900">
        <div className="mx-auto flex max-w-[1100px] gap-1 px-4 pt-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-800/80 text-white'
                    : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="px-4 py-6">
        <div
          className={`mx-auto ${
            isDetailPage ? 'max-w-[1100px]' : 'max-w-[640px]'
          }`}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
