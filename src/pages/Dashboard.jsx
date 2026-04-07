import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, fmtPct, CATEGORIAS, corStatus, MESES_NOME } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank, Percent } from 'lucide-react'

export default function Dashboard({ mes, ano }) {
  const {
    loading, receitaTotal, despesasFixas, despesasVariaveis,
    totalDespesas, totalCartao, saldoMes, gastosPorCategoria, orcamentos,
    config
  } = useFinanceiro(mes, ano)

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const pctPoupado = receitaTotal > 0 ? saldoMes / receitaTotal : 0

  const dadosCategoria = CATEGORIAS.map(cat => {
    const orc = orcamentos.find(o => o.categoria === cat)
    return {
      nome: cat.replace(/^\S+\s/, ''),
      realizado: gastosPorCategoria[cat] || 0,
      orcamento: orc?.valor || 0,
    }
  }).filter(d => d.realizado > 0 || d.orcamento > 0)

  const regra = [
    { label: 'Necessidades', pct: 0.5, realizado: despesasFixas },
    { label: 'Desejos', pct: 0.3, realizado: despesasVariaveis },
    { label: 'Poupança', pct: 0.2, realizado: saldoMes },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>{MESES_NOME[mes-1]} {ano} — atualizado em tempo real</p>
      </div>

      <div className="cards-grid">
        <SummaryCard color="green" icon={TrendingUp} label="Receita Total" value={fmt(receitaTotal)} sub={`${config.nome_pessoa1} + ${config.nome_pessoa2}`} />
        <SummaryCard color="red" icon={TrendingDown} label="Despesas Totais" value={fmt(totalDespesas)} sub={`Fixas: ${fmt(despesasFixas)}`} />
        <SummaryCard color="purple" icon={CreditCard} label="Total Cartão" value={fmt(totalCartao)} sub="dentro das despesas" />
        <SummaryCard color={saldoMes >= 0 ? 'green' : 'red'} icon={Wallet} label="Saldo do Mês" value={fmt(saldoMes)} sub={fmtPct(pctPoupado) + ' da receita'} />
      </div>

      <div className="grid-2 mb-24">
        {/* Regra 50-30-20 */}
        <div className="table-wrap">
          <div className="table-header"><h3>📏 Regra 50-30-20</h3></div>
          <div style={{ padding: '20px' }}>
            {regra.map(r => {
              const ideal = receitaTotal * r.pct
              const pct = ideal > 0 ? Math.min(r.realizado / ideal, 1.5) : 0
              const cor = r.realizado <= ideal ? 'var(--green)' : 'var(--red)'
              return (
                <div key={r.label} style={{ marginBottom: 16 }}>
                  <div className="flex-between mb-4">
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.label}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {fmt(r.realizado)} / {fmt(ideal)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct * 100}%`, background: cor }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Ideal: {(r.pct * 100)}% da receita
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Divisão do casal */}
        <div className="table-wrap">
          <div className="table-header"><h3>👫 Divisão do Casal</h3></div>
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th className="text-right">Receita</th>
                <th className="text-right">Despesas</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{config.nome_pessoa1}</td>
                <td className="text-right text-green">{fmt(receitaTotal - (parseFloat(config.receita_pessoa2) || 0))}</td>
                <td className="text-right text-red">{fmt(totalDespesas * 0.8)}</td>
                <td className="text-right">{fmt(receitaTotal * 0.8 - totalDespesas * 0.8)}</td>
              </tr>
              <tr>
                <td>{config.nome_pessoa2}</td>
                <td className="text-right text-green">{fmt(parseFloat(config.receita_pessoa2) || 0)}</td>
                <td className="text-right text-red">{fmt(totalDespesas * 0.2)}</td>
                <td className="text-right">{fmt((parseFloat(config.receita_pessoa2) || 0) - totalDespesas * 0.2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico de categorias */}
      {dadosCategoria.length > 0 && (
        <div className="table-wrap mb-24">
          <div className="table-header"><h3>📂 Gastos por Categoria</h3></div>
          <div style={{ padding: '20px', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosCategoria} margin={{ top: 0, right: 0, bottom: 0, left: 20 }}>
                <XAxis dataKey="nome" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                  formatter={v => fmt(v)}
                />
                <Bar dataKey="orcamento" fill="var(--surface3)" radius={[4,4,0,0]} name="Orçamento" />
                <Bar dataKey="realizado" radius={[4,4,0,0]} name="Realizado">
                  {dadosCategoria.map((d, i) => (
                    <Cell key={i} fill={d.realizado > d.orcamento && d.orcamento > 0 ? 'var(--red)' : 'var(--accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela de categorias */}
      <div className="table-wrap">
        <div className="table-header"><h3>📋 Detalhamento por Categoria</h3></div>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th className="text-right">Orçamento</th>
              <th className="text-right">Realizado</th>
              <th className="text-right">Diferença</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map(cat => {
              const orc = orcamentos.find(o => o.categoria === cat)?.valor || 0
              const real = gastosPorCategoria[cat] || 0
              if (real === 0 && orc === 0) return null
              const diff = orc - real
              const cor = corStatus(real, orc)
              return (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td className="text-right text-muted">{orc > 0 ? fmt(orc) : '—'}</td>
                  <td className="text-right">{fmt(real)}</td>
                  <td className={`text-right ${diff >= 0 ? 'text-green' : 'text-red'}`}>{orc > 0 ? fmt(diff) : '—'}</td>
                  <td>
                    <span className={`badge ${cor}`}>
                      {cor === 'green' ? '✓ OK' : cor === 'red' ? '✗ Excedido' : cor === 'yellow' ? '⚠ Atenção' : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({ color, icon: Icon, label, value, sub }) {
  return (
    <div className={`card ${color}`}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}
