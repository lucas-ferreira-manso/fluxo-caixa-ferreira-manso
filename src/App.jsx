import { useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, ListChecks, CreditCard,
  Target, BarChart3, Settings, LogOut, PiggyBank, Menu, X
} from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Receitas from './pages/Receitas'
import Lancamentos from './pages/Lancamentos'
import Cartao from './pages/Cartao'
import Metas from './pages/Metas'
import Historico from './pages/Historico'
import Configuracoes from './pages/Configuracoes'
import Investimentos from './pages/Investimentos'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Itens do menu — 5 na bottom nav (os mais importantes), resto em "Mais"
const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas' },
  { to: '/lancamentos', icon: ListChecks, label: 'Lançamentos' },
  { to: '/cartao', icon: CreditCard, label: 'Cartão' },
  { to: '/investimentos', icon: PiggyBank, label: 'Investimentos' },
  { to: '/metas', icon: Target, label: 'Metas' },
  { to: '/historico', icon: BarChart3, label: 'Histórico' },
  { to: '/configuracoes', icon: Settings, label: 'Config.' },
]

// Os 4 principais na bottom nav + botão "Mais"
const bottomNavMain = navItems.slice(0, 4)

export default function App() {
  const { user, loading, logout } = useAuth()
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading"><div className="spinner" /> Carregando...</div>
      </div>
    )
  }

  if (!user) return <Login />

  const mesOpts = [-2,-1,0,1,2].map(offset => {
    const d = new Date(ano, mes - 1 + offset, 1)
    const m = d.getMonth() + 1
    const a = d.getFullYear()
    return { value: `${m}-${a}`, label: `${MESES[m-1]} ${a}` }
  })

  const handleMesChange = (e) => {
    const [m, a] = e.target.value.split('-')
    setMes(Number(m))
    setAno(Number(a))
  }

  return (
    <div className="app-shell">
      {/* ---- SIDEBAR (desktop) ---- */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Financeiro<br/>do Casal</h1>
          <span>controle em tempo real</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon className="icon" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-mes">
          <label>Período</label>
          <select className="mes-select" value={`${mes}-${ano}`} onChange={handleMesChange}>
            {mesOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 6, wordBreak: 'break-all' }}>
              {user.email}
            </div>
            <button className="nav-item" style={{ width: '100%', color: 'var(--red)', padding: '8px 12px' }} onClick={logout}>
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* ---- MAIN CONTENT ---- */}
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard mes={mes} ano={ano} />} />
          <Route path="/receitas" element={<Receitas mes={mes} ano={ano} />} />
          <Route path="/lancamentos" element={<Lancamentos mes={mes} ano={ano} />} />
          <Route path="/cartao" element={<Cartao mes={mes} ano={ano} />} />
          <Route path="/investimentos" element={<Investimentos mes={mes} ano={ano} />} />
          <Route path="/metas" element={<Metas mes={mes} ano={ano} />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/configuracoes" element={<Configuracoes mes={mes} ano={ano} />} />
        </Routes>
      </main>

      {/* ---- BOTTOM NAV (mobile) ---- */}
      <nav className="bottom-nav">
        {bottomNavMain.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}

        {/* Botão "Mais" */}
        <button
          className="bottom-nav-item"
          onClick={() => setMenuMobileAberto(true)}
        >
          <Menu size={20} />
          Mais
        </button>
      </nav>

      {/* ---- MENU MOBILE COMPLETO (drawer) ---- */}
      {menuMobileAberto && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setMenuMobileAberto(false)}
        >
          <div
            style={{
              width: '100%',
              background: 'var(--surface)',
              borderRadius: 'var(--radius) var(--radius) 0 0',
              padding: '20px 20px 40px',
              border: '1px solid var(--border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 100, margin: '0 auto 20px' }} />

            {/* Seletor de mês */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Período
              </label>
              <select
                className="mes-select"
                value={`${mes}-${ano}`}
                onChange={handleMesChange}
                style={{ width: '100%' }}
              >
                {mesOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Todos os itens de navegação */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMenuMobileAberto(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? 'var(--accent-glow)' : 'var(--surface2)',
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                    border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                  })}
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>

            {/* Info usuário + sair */}
            <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 10 }}>{user.email}</div>
              <button
                onClick={() => { logout(); setMenuMobileAberto(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--red-bg)', color: 'var(--red)',
                  border: 'none', fontFamily: 'var(--font-body)',
                  fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                  width: '100%',
                }}
              >
                <LogOut size={16} /> Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
