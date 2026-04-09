import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type Agent } from '../lib/api';

const STATUS_LABELS: Record<Agent['status'], string> = {
  idle: '未安装',
  installing: '安装中…',
  connected: '已连接',
};

const STATUS_CLASSES: Record<Agent['status'], string> = {
  idle: 'bg-gray-700 text-gray-300',
  installing: 'bg-yellow-500/20 text-yellow-300 animate-pulse',
  connected: 'bg-green-500/20 text-green-300',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<Agent | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const baseUrl = window.location.origin;

  const loadAgents = useCallback(async () => {
    try {
      const data = await api.listAgents();
      setAgents(data);
    } catch (err) {
      console.error('加载 Agent 列表失败', err);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Status polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.listAgents();
        // Only update status badges, preserve expanded/UI state
        setAgents((prev) =>
          prev.map((agent) => {
            const updated = data.find((a) => a.id === agent.id);
            return updated ? { ...agent, status: updated.status } : agent;
          })
        );
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const agent = await api.createAgent(name.trim());
      setNewlyCreated(agent);
      setName('');
      await loadAgents();
    } catch (err) {
      console.error('创建 Agent 失败', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteAgent(id);
      setConfirmDeleteId(null);
      if (newlyCreated?.id === id) setNewlyCreated(null);
      await loadAgents();
    } catch (err) {
      console.error('删除 Agent 失败', err);
    }
  };

  const getInstallCommand = (agent: Agent) =>
    `从 ${baseUrl}/api/agents/${agent.id}/install?key=${agent.key} 安装 skill，并应用下列配置：MINDX_BASE_URL=${baseUrl} MINDX_API_KEY=${agent.key}`;

  const handleCopy = async (agent: Agent) => {
    try {
      await navigator.clipboard.writeText(getInstallCommand(agent));
      setCopiedId(agent.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      console.error('复制失败');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <h1 className="text-2xl font-bold mb-6">Agent 管理</h1>

      {/* Create form */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Agent 名称"
            className="flex-1 bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors"
          >
            {creating ? '创建中…' : '创建'}
          </button>
        </div>

        {/* Newly created agent info */}
        {newlyCreated && (
          <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
            <p className="text-sm text-green-400 mb-2">
              Agent「{newlyCreated.name}」创建成功
            </p>
            <p className="text-xs text-slate-400 mb-2">安装命令：</p>
            <pre className="bg-slate-950 text-slate-300 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
              {getInstallCommand(newlyCreated)}
            </pre>
            <button
              onClick={() => handleCopy(newlyCreated)}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {copiedId === newlyCreated.id ? '已复制！' : '复制'}
            </button>
          </div>
        )}
      </div>

      {/* Agent list */}
      {agents.length === 0 ? (
        <p className="text-slate-500 text-center py-12">暂无 Agent</p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
            >
              {/* Agent header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-750 transition-colors"
                onClick={() => setExpandedId(expandedId === agent.id ? null : agent.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{agent.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASSES[agent.status]}`}
                  >
                    {STATUS_LABELS[agent.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">
                    创建于 {formatDate(agent.created_at)}
                  </span>
                  {confirmDeleteId === agent.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-red-400">确认删除？</span>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        是
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-slate-400 hover:text-slate-300"
                      >
                        否
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(agent.id);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>

              {/* Install command (collapsible) */}
              {expandedId === agent.id && (
                <div className="px-4 pb-4 border-t border-slate-700 pt-3">
                  <p className="text-xs text-slate-400 mb-2">安装命令：</p>
                  <pre className="bg-slate-950 text-slate-300 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                    {getInstallCommand(agent)}
                  </pre>
                  <button
                    onClick={() => handleCopy(agent)}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {copiedId === agent.id ? '已复制！' : '复制'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
