import { useState, useEffect } from 'react'
import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, fmtPct, CATEGORIAS, corStatus, MESES_NOME } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'

export default function Dashboard({ mes, ano }) {
  const {
    loading, receitaTotal, despesasFixas, despesasVariaveis,
    totalDespesas, totalCartao, saldoMes, gastosPorCategoria,
    orcamentos, config, cartoes, lancamentos
  } = useFinanceiro(mes, ano)

  // Dados do próximo mês para projeção
  const [proximoMesData, setProximoMesData] = useState({ faturas: [], fixas: [] })
  const [loadingProximo, setLoadingProximo] = useState(true)

  const proximoMes = mes === 12 ? 1 : mes + 1
  const proximoAno = mes === 12 ? ano + 1 : ano

  useEffect(() => {
    const carregarProximo = async () => {
      setLoadingProximo(true)
      const [faturas, fixas] = await Promise.all([
        // Faturas de cartão já lançadas para o próximo mês
        supabase.from('lancamentos').select('*')
          .eq('mes', proximoMes).eq('ano', proximoAno)
          .not('cartao_id', 'is', null),
        // Despesas fixas do mês atual (projeção de recorrência)
        supabase.from('lancamentos').select('*')
          .eq('mes', mes).eq('ano', ano)
          .eq('tipo', 'Despesa Fixa')
          .is('cartao_id', null),
      ])
      setProximoMesData({
        faturas: faturas.data || [],
        fixas: fixas.data || [],
      })
      setLoadingProximo(false)
    }
    if (!loading) carregarProximo()
  }, [mes, ano, proximoMes, proximoAno, loading])

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
    { label: '🏠 Necessidades', pct: 0.5, realizado: despesasFixas },
    { label: '🎭 Desejos', pct: 0.3, realizado: despesasVariaveis },
    { label: '💰 Poupança', pct: 0.2, realizado: Math.max(saldoMes, 0) },
  ]

  // Projeção próximo mês
  const totalFaturasProximo = proximoMesData.faturas.reduce((a, l) => a + l.valor, 0)
  const totalFixasProximo = proximoMesData.fixas.reduce((a, l) => a + l.valor, 0)
  const totalComprometido = totalFaturasProximo + totalFixasProximo
  const saldoProjetado = receitaTotal - totalComprometido

  // Faturas por cartão no próximo mês
  const faturasPorCartao = cartoes.map(c => ({
    ...c,
    total: proximoMesData.faturas.filter(l => l.cartao_id === c.id).reduce((a, l) => a + l.valor, 0)
  })).filter(c => c.total > 0)

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>{MESES_NOME[mes - 1]} {ano} — atualizado em tempo real</p>
      </div>

      {/* Cards resumo mês atual */}
      <div className="cards-grid mb-24">
        <SummaryCard color="green" label="Receita Total" value={fmt(receitaTotal)} sub={`${config.nome_pessoa1} + ${config.nome_pessoa2}`} />
        <SummaryCard color="red" label="Despesas Totais" value={fmt(totalDespesas)} sub={`Fixas: ${fmt(despesasFixas)}`} />
        <SummaryCard color="purple" label="Total Cartão" value={fmt(totalCartao)} sub="dentro das despesas" />
        <SummaryCard color={saldoMes >= 0 ? 'green' : 'red'} label="Saldo do Mês" value={fmt(saldoMes)} sub={fmtPct(pctPoupado) + ' da receita'} />
      </div>

      {/* PROJEÇÃO PRÓXIMO MÊS */}
      <div className="table-wrap mb-24" style={{ borderTop: '2px solid var(--accent)' }}>
        <div className="table-header">
          <h3>🔮 Projeção — {MESES_NOME[proximoMes - 1]} {proximoAno}</h3>
          <span className="text-sm text-muted">Com base nas faturas lançadas e despesas fixas recorrentes</span>
        </div>

        {loadingProximo ? (
          <div className="loading" style={{ minHeight: 80 }}><div className="spinner" /> Calculando...</div>
        ) : (
          <div style={{ padding: 20 }}>

            {/* Cards projeção */}
            <div className="cards-grid mb-16">
              <div className="card purple">
                <div className="card-label">💳 Faturas de Cartão</div>
                <div className="card-value">{fmt(totalFaturasProximo)}</div>
                <div className="card-sub">
                  {faturasPorCartao.length > 0
                    ? faturasPorCartao.map(c => `${c.nome}: ${fmt(c.total)}`).join(' · ')
                    : 'Nenhuma fatura lançada ainda'}
                </div>
              </div>
              <div className="card red">
                <div className="card-label">🔁 Despesas Fixas (projeção)</div>
                <div className="card-value">{fmt(totalFixasProximo)}</div>
                <div className="card-sub">Baseado nas fixas de {MESES_NOME[mes - 1]}</div>
              </div>
              <div className="card yellow">
                <div className="card-label">📊 Total Comprometido</div>
                <div className="card-value">{fmt(totalComprometido)}</div>
                <div className="card-sub">Faturas + Fixas recorrentes</div>
              </div>
              <div className={`card ${saldoProjetado >= 0 ? 'green' : 'red'}`}>
                <div className="card-label">💰 Saldo Projetado</div>
                <div className="card-value">{fmt(saldoProjetado)}</div>
                <div className="card-sub">Receita atual − comprometido</div>
              </div>
            </div>

            {/* Detalhamento faturas por cartão */}
            {faturasPorCartao.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="section-title">Faturas por cartão em {MESES_NOME[proximoMes - 1]}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {faturasPorCartao.map(c => (
                    <div key={c.id} style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 16px',
                      minWidth: 180,
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>💳 {c.nome}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--accent)' }}>{fmt(c.total)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 4 }}>vence dia {c.dia_vencimento}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detalhamento fixas recorrentes */}
            {proximoMesData.fixas.length > 0 && (
              <div>
                <div className="section-title">Despesas fixas recorrentes previstas</div>
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Pessoa</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proximoMesData.fixas.map(l => (
                      <tr key={l.id}>
                        <td>{l.descricao || '—'}</td>
                        <td>{l.categoria}</td>
                        <td className="text-muted">{l.pessoa}</td>
                        <td className="text-right text-red">{fmt(l.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalComprometido === 0 && (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>Nenhuma fatura ou despesa fixa projetada para {MESES_NOME[proximoMes - 1]} ainda.</p>
              </div>
            )}
          </div>
        )}
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
              {[
                { nome: config.nome_pessoa1, filtro: config.nome_pessoa1 },
                { nome: config.nome_pessoa2, filtro: config.nome_pessoa2 },
              ].map(p => {
                const desp = lancamentos.filter(l => l.pessoa === p.filtro).reduce((a, l) => a + l.valor, 0)
                return (
                  <tr key={p.nome}>
                    <td>{p.nome}</td>
                    <td className="text-right text-green">—</td>
                    <td className="text-right text-red">{fmt(desp)}</td>
                    <td className="text-right">{fmt(-desp)}</td>
                  </tr>
                )
              })}
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
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                  formatter={v => fmt(v)}
                />
                <Bar dataKey="orcamento" fill="var(--surface3)" radius={[4, 4, 0, 0]} name="Orçamento" />
                <Bar dataKey="realizado" radius={[4, 4, 0, 0]} name="Realizado">
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

function SummaryCard({ color, label, value, sub }) {
  return (
    <div className={`card ${color}`}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  )
}
