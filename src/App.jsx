import { useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, ListChecks, CreditCard, Target, BarChart3, Settings
} from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Receitas from './pages/Receitas'
import Lancamentos from './pages/Lancamentos'
import Cartao from './pages/Cartao'
import Metas from './pages/Metas'
import Historico from './pages/Historico'
import Configuracoes from './pages/Configuracoes'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/receitas', icon: TrendingUp, label: 'Receitas' },
  { to: '/lancamentos', icon: ListChecks, label: 'Lançamentos' },
  { to: '/cartao', icon: CreditCard, label: 'Cartão' },
  { to: '/metas', icon: Target, label: 'Metas' },
  { to: '/historico', icon: BarChart3, label: 'Histórico' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
]

export default function App() {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  return (
    <div className="app-shell">
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
          <select
            className="mes-select"
            value={`${mes}-${ano}`}
            onChange={e => {
              const [m, a] = e.target.value.split('-')
              setMes(Number(m))
              setAno(Number(a))
            }}
          >
            {[-2,-1,0,1,2].map(offset => {
              const d = new Date(ano, mes - 1 + offset, 1)
              const m = d.getMonth() + 1
              const a = d.getFullYear()
              return (
                <option key={`${m}-${a}`} value={`${m}-${a}`}>
                  {MESES[m-1]} {a}
                </option>
              )
            })}
          </select>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard mes={mes} ano={ano} />} />
          <Route path="/receitas" element={<Receitas mes={mes} ano={ano} />} />
          <Route path="/lancamentos" element={<Lancamentos mes={mes} ano={ano} />} />
          <Route path="/cartao" element={<Cartao mes={mes} ano={ano} />} />
          <Route path="/metas" element={<Metas mes={mes} ano={ano} />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/configuracoes" element={<Configuracoes mes={mes} ano={ano} />} />
        </Routes>
      </main>
    </div>
  )
}
