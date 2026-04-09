import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import Layout from './components/Layout'
import NotesPage from './components/NotesPage'
import NoteDetail from './components/NoteDetail'
import DocsPage from './components/DocsPage'
import DocDetail from './components/DocDetail'
import InsightsPage from './components/InsightsPage'
import AgentsPage from './components/AgentsPage'

export default function App() {
  const { user } = useAuth()

  if (!user) return <LoginScreen />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/notes/:id" element={<NoteDetail />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/:id" element={<DocDetail />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="*" element={<Navigate to="/notes" replace />} />
      </Route>
    </Routes>
  )
}
