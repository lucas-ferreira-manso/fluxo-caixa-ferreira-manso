import { useState } from 'react'
import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, fmtPct, CATEGORIAS, corStatus, MESES_NOME } from '../lib/utils'

export default function Cartao({ mes, ano }) {
  const { loading, totalCartao, cartaoPorCategoria, orcamentos, salvarOrcamento } = useFinanceiro(mes, ano)
  const [editando, setEditando] = useState(null)
  const [novoOrc, setNovoOrc] = useState('')
  const [limiteCartao, setLimiteCartao] = useState(0)

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const pctLimite = limiteCartao > 0 ? totalCartao / limiteCartao : 0

  const dicas = {
    '🏠 Moradia': 'Evite parcelar contas fixas no cartão',
    '🍽️ Alimentação': 'Prefira débito/Pix em restaurantes',
    '🚗 Transporte': 'Gasolina no cartão só se tiver cashback',
    '🏥 Saúde': 'Verifique plano de saúde em débito',
    '📚 Educação': 'Parcele apenas cursos estratégicos',
    '🎭 Lazer': 'Defina um teto mensal e respeite',
    '👗 Vestuário': 'Espere 48h antes de comprar por impulso',
    '🛒 Supermercado': 'Use cartão com cashback nesta categoria',
    '📱 Assinaturas/Tech': 'Revise assinaturas todo trimestre',
    '🐾 Pet': 'Reserve fundo de emergência para pet',
    '💆 Bem-estar': 'OK usar cartão se for recorrente e planejado',
    '🔧 Outros': 'Classifique melhor para não acumular aqui',
  }

  const salvarOrc = async (cat) => {
    await salvarOrcamento(cat, parseFloat(novoOrc) || 0)
    setEditando(null)
  }

  const totalOrc = CATEGORIAS.reduce((a, cat) => a + (orcamentos.find(o => o.categoria === cat)?.valor || 0), 0)
  const totalReal = CATEGORIAS.reduce((a, cat) => a + (cartaoPorCategoria[cat] || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h2>Cartão de Crédito</h2>
        <p>{MESES_NOME[mes-1]} {ano}</p>
      </div>

      <div className="cards-grid mb-24">
        <div className="card purple">
          <div className="card-label">Total da Fatura</div>
          <div className="card-value">{fmt(totalCartao)}</div>
        </div>
        <div className="card blue">
          <div className="card-label">Limite do Cartão</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input
              type="number"
              value={limiteCartao || ''}
              onChange={e => setLimiteCartao(parseFloat(e.target.value) || 0)}
              placeholder="Informe o limite"
              style={{ fontSize: '1rem', padding: '6px 10px' }}
            />
          </div>
        </div>
        <div className={`card ${pctLimite > 0.9 ? 'red' : pctLimite > 0.7 ? 'yellow' : 'green'}`}>
          <div className="card-label">% do Limite Usado</div>
          <div className="card-value">{limiteCartao > 0 ? fmtPct(pctLimite) : '—'}</div>
          {limiteCartao > 0 && (
            <div className="progress-bar mt-8">
              <div className="progress-fill" style={{ width: `${Math.min(pctLimite * 100, 100)}%`, background: pctLimite > 0.9 ? 'var(--red)' : pctLimite > 0.7 ? 'var(--yellow)' : 'var(--green)' }} />
            </div>
          )}
        </div>
        <div className={`card ${totalReal > totalOrc && totalOrc > 0 ? 'red' : 'green'}`}>
          <div className="card-label">Orçado vs Realizado</div>
          <div className="card-value">{fmt(totalReal)} / {fmt(totalOrc)}</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <h3>📂 Gastos no Cartão por Categoria</h3>
          <span className="text-sm text-muted">Clique no orçamento para editar</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th className="text-right">Orçamento Cartão</th>
              <th className="text-right">Gasto Real</th>
              <th className="text-right">Diferença</th>
              <th>Status</th>
              <th>Dica</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map(cat => {
              const orc = orcamentos.find(o => o.categoria === cat)?.valor || 0
              const real = cartaoPorCategoria[cat] || 0
              if (real === 0 && orc === 0) return null
              const diff = orc - real
              const cor = corStatus(real, orc)

              return (
                <tr key={cat}>
                  <td><strong>{cat}</strong></td>
                  <td className="text-right">
                    {editando === cat ? (
                      <div className="flex-center" style={{ justifyContent: 'flex-end' }}>
                        <input
                          type="number" step="0.01"
                          value={novoOrc}
                          onChange={e => setNovoOrc(e.target.value)}
                          style={{ width: 90, padding: '4px 6px', fontSize: '0.8rem' }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => salvarOrc(cat)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>×</button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', color: 'var(--yellow)', textDecoration: 'underline dotted' }}
                        onClick={() => { setEditando(cat); setNovoOrc(orc) }}
                        title="Clique para editar"
                      >
                        {orc > 0 ? fmt(orc) : '+ definir'}
                      </span>
                    )}
                  </td>
                  <td className="text-right">{real > 0 ? fmt(real) : '—'}</td>
                  <td className={`text-right ${diff >= 0 ? 'text-green' : 'text-red'}`}>
                    {orc > 0 ? fmt(diff) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${cor}`}>
                      {cor === 'green' ? '✓ OK' : cor === 'red' ? '✗ Excedido' : cor === 'yellow' ? '⚠ Atenção' : '—'}
                    </span>
                  </td>
                  <td className="text-muted text-sm" style={{ maxWidth: 200 }}>{dicas[cat]}</td>
                </tr>
              )
            })}
            <tr style={{ background: 'var(--surface2)' }}>
              <td><strong>TOTAL</strong></td>
              <td className="text-right"><strong>{fmt(totalOrc)}</strong></td>
              <td className="text-right"><strong>{fmt(totalReal)}</strong></td>
              <td className={`text-right ${totalOrc - totalReal >= 0 ? 'text-green' : 'text-red'}`}>
                <strong>{fmt(totalOrc - totalReal)}</strong>
              </td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
