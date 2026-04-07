import { useState } from 'react'
import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, MESES_NOME } from '../lib/utils'
import { Plus, Trash2, DollarSign, Edit2 } from 'lucide-react'

const FONTES_P1 = ['💼 Salário principal', '🖥️ Freela / Consultoria', '📦 Produto digital', '📈 Renda passiva', '➕ Outra']
const FONTES_P2 = ['💼 Salário / Pró-labore', '📊 Freelance / Extra', '📈 Renda passiva', '➕ Outra']

export default function Receitas({ mes, ano }) {
  const { loading, receitas, receitaTotal, config, cotacao, salvarReceita, excluirReceita, salvarConfig } = useFinanceiro(mes, ano)
  const [modal, setModal] = useState(null) // null | 'nova' | objeto para editar
  const [form, setForm] = useState({})
  const [cotacaoEdit, setCotacaoEdit] = useState(false)
  const [novaCotacao, setNovaCotacao] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const p1Receitas = receitas.filter(r => r.pessoa === 'pessoa1')
  const p2Receitas = receitas.filter(r => r.pessoa === 'pessoa2')
  const totalP1 = p1Receitas.reduce((a, r) => a + (r.moeda === 'USD' ? r.valor * cotacao : r.valor), 0)
  const totalP2 = p2Receitas.reduce((a, r) => a + r.valor, 0)

  const abrirNova = (pessoa) => {
    setForm({ pessoa, moeda: pessoa === 'pessoa1' ? 'USD' : 'BRL', recorrente: true, descricao: '', valor: '', observacao: '' })
    setModal('nova')
  }

  const abrirEditar = (r) => {
    setForm({ ...r })
    setModal('editar')
  }

  const salvar = async () => {
    if (!form.descricao || !form.valor) return
    setSaving(true)
    await salvarReceita({ ...form, valor: parseFloat(form.valor) })
    setSaving(false)
    setModal(null)
  }

  const salvarCotacao = async () => {
    await salvarConfig('cotacao_usd', novaCotacao)
    setCotacaoEdit(false)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Receitas</h2>
        <p>{MESES_NOME[mes-1]} {ano}</p>
      </div>

      {/* Card receita total + cotação */}
      <div className="cards-grid mb-24">
        <div className="card green">
          <div className="card-label">Receita Total do Casal</div>
          <div className="card-value">{fmt(receitaTotal)}</div>
          <div className="card-sub">{fmt(totalP1)} + {fmt(totalP2)}</div>
        </div>
        <div className="card yellow">
          <div className="card-label">Cotação USD → BRL</div>
          <div className="card-value">R$ {parseFloat(config.cotacao_usd || 5.14).toFixed(2)}</div>
          {cotacaoEdit ? (
            <div className="flex-center mt-8">
              <input
                type="number" step="0.01"
                value={novaCotacao}
                onChange={e => setNovaCotacao(e.target.value)}
                style={{ width: 100, padding: '4px 8px', fontSize: '0.875rem' }}
              />
              <button className="btn btn-primary btn-sm" onClick={salvarCotacao}>Salvar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCotacaoEdit(false)}>×</button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm mt-8" onClick={() => { setCotacaoEdit(true); setNovaCotacao(config.cotacao_usd) }}>
              <Edit2 size={12} /> Atualizar cotação
            </button>
          )}
        </div>
        <div className="card blue">
          <div className="card-label">{config.nome_pessoa1} (USD)</div>
          <div className="card-value">{fmt(totalP1)}</div>
          <div className="card-sub">{p1Receitas.reduce((a,r)=>a+r.valor,0).toLocaleString('en')} USD</div>
        </div>
        <div className="card purple">
          <div className="card-label">{config.nome_pessoa2} (BRL)</div>
          <div className="card-value">{fmt(totalP2)}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Pessoa 1 */}
        <div className="table-wrap">
          <div className="table-header">
            <h3>🇺🇸 {config.nome_pessoa1} — Receitas em USD</h3>
            <button className="btn btn-primary btn-sm" onClick={() => abrirNova('pessoa1')}>
              <Plus size={14} /> Adicionar
            </button>
          </div>
          {p1Receitas.length === 0 ? (
            <div className="empty-state"><p>Nenhuma receita cadastrada</p></div>
          ) : (
            <table>
              <thead><tr><th>Fonte</th><th className="text-right">USD</th><th className="text-right">BRL</th><th></th></tr></thead>
              <tbody>
                {p1Receitas.map(r => (
                  <tr key={r.id}>
                    <td>
                      {r.descricao}
                      {r.recorrente && <span className="badge green" style={{ marginLeft: 6 }}>recorrente</span>}
                    </td>
                    <td className="text-right text-muted">{r.moeda === 'USD' ? `$${r.valor.toLocaleString('en')}` : '—'}</td>
                    <td className="text-right text-green">{fmt(r.moeda === 'USD' ? r.valor * cotacao : r.valor)}</td>
                    <td>
                      <div className="flex-center">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditar(r)}><Edit2 size={13} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluirReceita(r.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}><strong>Total</strong></td>
                  <td className="text-right"><strong className="text-green">{fmt(totalP1)}</strong></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Pessoa 2 */}
        <div className="table-wrap">
          <div className="table-header">
            <h3>🇧🇷 {config.nome_pessoa2} — Receitas em BRL</h3>
            <button className="btn btn-primary btn-sm" onClick={() => abrirNova('pessoa2')}>
              <Plus size={14} /> Adicionar
            </button>
          </div>
          {p2Receitas.length === 0 ? (
            <div className="empty-state"><p>Nenhuma receita cadastrada</p></div>
          ) : (
            <table>
              <thead><tr><th>Fonte</th><th className="text-right">Valor (BRL)</th><th></th></tr></thead>
              <tbody>
                {p2Receitas.map(r => (
                  <tr key={r.id}>
                    <td>
                      {r.descricao}
                      {r.recorrente && <span className="badge green" style={{ marginLeft: 6 }}>recorrente</span>}
                    </td>
                    <td className="text-right text-green">{fmt(r.valor)}</td>
                    <td>
                      <div className="flex-center">
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditar(r)}><Edit2 size={13} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluirReceita(r.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  <td className="text-right"><strong className="text-green">{fmt(totalP2)}</strong></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal === 'editar' ? 'Editar Receita' : 'Nova Receita'}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Descrição / Fonte</label>
                <input value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Salário, Freela..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Valor</label>
                  <input type="number" step="0.01" value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Moeda</label>
                  <select value={form.moeda || 'BRL'} onChange={e => setForm(f => ({ ...f, moeda: e.target.value }))}>
                    <option value="BRL">BRL (Real)</option>
                    <option value="USD">USD (Dólar)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Observação</label>
                <input value={form.observacao || ''} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={form.recorrente || false} onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))} />
                  Receita recorrente (mensal)
                </label>
              </div>
              {form.moeda === 'USD' && (
                <div className="card yellow" style={{ padding: 12 }}>
                  <div className="card-label">Valor em BRL</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--yellow)' }}>
                    {fmt((parseFloat(form.valor) || 0) * cotacao)}
                  </div>
                  <div className="card-sub">cotação: R$ {cotacao}</div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
