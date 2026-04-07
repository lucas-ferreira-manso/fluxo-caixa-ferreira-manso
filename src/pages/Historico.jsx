import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, MESES_NOME } from '../lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function Historico() {
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const anoAtual = new Date().getFullYear()

  useEffect(() => {
    const carregar = async () => {
      setLoading(true)
      const [l, r] = await Promise.all([
        supabase.from('lancamentos').select('*').eq('ano', anoAtual),
        supabase.from('receitas').select('*').eq('ano', anoAtual),
      ])
      const lancamentos = l.data || []
      const receitas = r.data || []

      const meses = Array.from({ length: 12 }, (_, i) => i + 1)
      const historico = meses.map(mes => {
        const lanMes = lancamentos.filter(l => l.mes === mes)
        const recMes = receitas.filter(r => r.mes === mes)
        const receita = recMes.reduce((a, r) => a + r.valor, 0)
        const despFixas = lanMes.filter(l => l.tipo === 'Despesa Fixa').reduce((a, l) => a + l.valor, 0)
        const despVar = lanMes.filter(l => l.tipo === 'Despesa Variável').reduce((a, l) => a + l.valor, 0)
        const cartao = lanMes.filter(l => l.forma_pagamento === 'Cartão de Crédito').reduce((a, l) => a + l.valor, 0)
        const invest = lanMes.filter(l => l.tipo === 'Investimento').reduce((a, l) => a + l.valor, 0)
        const saldo = receita - despFixas - despVar - invest
        return { mes: MESES_NOME[mes-1].slice(0,3), receita, despFixas, despVar, cartao, invest, saldo }
      })

      setDados(historico)
      setLoading(false)
    }
    carregar()
  }, [anoAtual])

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const totais = dados.reduce((acc, d) => ({
    receita: acc.receita + d.receita,
    despFixas: acc.despFixas + d.despFixas,
    despVar: acc.despVar + d.despVar,
    cartao: acc.cartao + d.cartao,
    invest: acc.invest + d.invest,
    saldo: acc.saldo + d.saldo,
  }), { receita: 0, despFixas: 0, despVar: 0, cartao: 0, invest: 0, saldo: 0 })

  const temDados = dados.some(d => d.receita > 0 || d.despFixas > 0)

  return (
    <div>
      <div className="page-header">
        <h2>Histórico Anual</h2>
        <p>{anoAtual} — evolução mês a mês</p>
      </div>

      {/* Totais do ano */}
      <div className="cards-grid mb-24">
        <div className="card green">
          <div className="card-label">Receita Total {anoAtual}</div>
          <div className="card-value">{fmt(totais.receita)}</div>
        </div>
        <div className="card red">
          <div className="card-label">Despesas Totais</div>
          <div className="card-value">{fmt(totais.despFixas + totais.despVar)}</div>
        </div>
        <div className="card blue">
          <div className="card-label">Investimentos</div>
          <div className="card-value">{fmt(totais.invest)}</div>
        </div>
        <div className={`card ${totais.saldo >= 0 ? 'green' : 'red'}`}>
          <div className="card-label">Saldo Acumulado</div>
          <div className="card-value">{fmt(totais.saldo)}</div>
        </div>
      </div>

      {temDados ? (
        <>
          {/* Gráfico */}
          <div className="table-wrap mb-24">
            <div className="table-header"><h3>📈 Evolução Mensal</h3></div>
            <div style={{ padding: '20px', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados}>
                  <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                    formatter={v => fmt(v)}
                  />
                  <Legend wrapperStyle={{ color: 'var(--text-muted)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="receita" stroke="var(--green)" strokeWidth={2} dot={false} name="Receita" />
                  <Line type="monotone" dataKey="despFixas" stroke="var(--red)" strokeWidth={2} dot={false} name="Desp. Fixas" />
                  <Line type="monotone" dataKey="saldo" stroke="var(--accent)" strokeWidth={2} dot={false} name="Saldo" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela detalhada */}
          <div className="table-wrap">
            <div className="table-header"><h3>📋 Detalhamento Mensal</h3></div>
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="text-right">Receita</th>
                  <th className="text-right">Desp. Fixas</th>
                  <th className="text-right">Desp. Variáveis</th>
                  <th className="text-right">Cartão</th>
                  <th className="text-right">Investimentos</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((d, i) => (
                  <tr key={i} style={{ opacity: d.receita === 0 && d.despFixas === 0 ? 0.35 : 1 }}>
                    <td><strong>{MESES_NOME[i]}</strong></td>
                    <td className="text-right text-green">{d.receita > 0 ? fmt(d.receita) : '—'}</td>
                    <td className="text-right text-red">{d.despFixas > 0 ? fmt(d.despFixas) : '—'}</td>
                    <td className="text-right text-yellow">{d.despVar > 0 ? fmt(d.despVar) : '—'}</td>
                    <td className="text-right" style={{ color: 'var(--accent)' }}>{d.cartao > 0 ? fmt(d.cartao) : '—'}</td>
                    <td className="text-right text-blue">{d.invest > 0 ? fmt(d.invest) : '—'}</td>
                    <td className={`text-right ${d.saldo >= 0 ? 'text-green' : 'text-red'}`}>
                      {d.receita > 0 || d.despFixas > 0 ? fmt(d.saldo) : '—'}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td className="text-right text-green">{fmt(totais.receita)}</td>
                  <td className="text-right text-red">{fmt(totais.despFixas)}</td>
                  <td className="text-right text-yellow">{fmt(totais.despVar)}</td>
                  <td className="text-right" style={{ color: 'var(--accent)' }}>{fmt(totais.cartao)}</td>
                  <td className="text-right text-blue">{fmt(totais.invest)}</td>
                  <td className={`text-right ${totais.saldo >= 0 ? 'text-green' : 'text-red'}`}>{fmt(totais.saldo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>Nenhum dado registrado em {anoAtual} ainda.<br />Comece adicionando receitas e lançamentos nos outros meses.</p>
        </div>
      )}
    </div>
  )
}
