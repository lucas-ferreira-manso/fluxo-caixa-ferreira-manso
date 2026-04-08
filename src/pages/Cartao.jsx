import { useState } from 'react'
import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, fmtPct, CATEGORIAS, corStatus, MESES_NOME } from '../lib/utils'
import { Plus, Edit2, Trash2 } from 'lucide-react'

export default function Cartao({ mes, ano }) {
  const {
    loading, lancamentos, cartoes, orcamentos,
    totalCartao, cartaoPorCategoria, salvarOrcamento,
    salvarCartao, excluirCartao
  } = useFinanceiro(mes, ano)

  const [editandoOrc, setEditandoOrc] = useState(null)
  const [novoOrc, setNovoOrc] = useState('')
  const [modalCartao, setModalCartao] = useState(null) // null | 'novo' | objeto
  const [formCartao, setFormCartao] = useState({ nome: '', dia_fechamento: 4, dia_vencimento: 11 })
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

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

  // Total por cartão
  const totalPorCartao = cartoes.map(c => ({
    ...c,
    total: lancamentos.filter(l => l.cartao_id === c.id).reduce((a, l) => a + l.valor, 0)
  }))

  const salvarOrc = async (cat) => {
    await salvarOrcamento(cat, parseFloat(novoOrc) || 0)
    setEditandoOrc(null)
  }

  const abrirNovoCartao = () => {
    setFormCartao({ nome: '', dia_fechamento: 4, dia_vencimento: 11 })
    setModalCartao('novo')
  }

  const abrirEditarCartao = (c) => {
    setFormCartao({ nome: c.nome, dia_fechamento: c.dia_fechamento, dia_vencimento: c.dia_vencimento })
    setModalCartao(c)
  }

  const salvarCartaoForm = async () => {
    if (!formCartao.nome) return
    setSaving(true)
    if (modalCartao === 'novo') {
      await salvarCartao(formCartao)
    } else {
      await salvarCartao({ ...modalCartao, ...formCartao })
    }
    setSaving(false)
    setModalCartao(null)
  }

  const totalOrc = CATEGORIAS.reduce((a, cat) => a + (orcamentos.find(o => o.categoria === cat)?.valor || 0), 0)
  const totalReal = CATEGORIAS.reduce((a, cat) => a + (cartaoPorCategoria[cat] || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h2>Cartão de Crédito</h2>
        <p>{MESES_NOME[mes - 1]} {ano}</p>
      </div>

      {/* Resumo por cartão */}
      <div className="mb-24">
        <div className="flex-between mb-16">
          <div className="section-title" style={{ margin: 0 }}>Meus Cartões</div>
          <button className="btn btn-primary btn-sm" onClick={abrirNovoCartao}>
            <Plus size={14} /> Novo cartão
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {cartoes.map(c => {
            const totalC = totalPorCartao.find(t => t.id === c.id)?.total || 0
            return (
              <div key={c.id} className="card purple" style={{ position: 'relative' }}>
                <div className="flex-between mb-8">
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>💳 {c.nome}</div>
                  <div className="flex-center" style={{ gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditarCartao(c)}>
                      <Edit2 size={13} />
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluirCartao(c.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent)' }}>
                  {fmt(totalC)}
                </div>
                <div className="text-muted text-sm mt-4">
                  Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento}
                </div>
              </div>
            )
          })}

          {cartoes.length === 0 && (
            <div className="empty-state">
              <p>Nenhum cartão cadastrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabela por categoria */}
      <div className="table-wrap">
        <div className="table-header">
          <h3>📂 Gastos no Cartão por Categoria</h3>
          <span className="text-sm text-muted">Clique no orçamento para editar</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th className="text-right">Orçamento</th>
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
                    {editandoOrc === cat ? (
                      <div className="flex-center" style={{ justifyContent: 'flex-end' }}>
                        <input
                          type="number" step="0.01"
                          value={novoOrc}
                          onChange={e => setNovoOrc(e.target.value)}
                          style={{ width: 90, padding: '4px 6px', fontSize: '0.8rem' }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => salvarOrc(cat)}>✓</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditandoOrc(null)}>×</button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', color: 'var(--yellow)', textDecoration: 'underline dotted' }}
                        onClick={() => { setEditandoOrc(cat); setNovoOrc(orc) }}
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

      {/* Modal cartão */}
      {modalCartao && (
        <div className="modal-overlay" onClick={() => setModalCartao(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modalCartao === 'novo' ? '+ Novo Cartão' : `✏️ Editar ${modalCartao.nome}`}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalCartao(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome do Cartão</label>
                <input
                  value={formCartao.nome}
                  onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Nubank, BTG, Inter..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Dia de fechamento</label>
                  <input
                    type="number" min="1" max="31"
                    value={formCartao.dia_fechamento}
                    onChange={e => setFormCartao(f => ({ ...f, dia_fechamento: parseInt(e.target.value) }))}
                  />
                  <div className="text-muted text-sm mt-4">Compras após este dia vão para a próxima fatura</div>
                </div>
                <div className="form-group">
                  <label>Dia de vencimento</label>
                  <input
                    type="number" min="1" max="31"
                    value={formCartao.dia_vencimento}
                    onChange={e => setFormCartao(f => ({ ...f, dia_vencimento: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalCartao(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarCartaoForm} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
