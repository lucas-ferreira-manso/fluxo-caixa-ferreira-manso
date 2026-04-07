import { useState } from 'react'
import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, fmtPct, MESES_NOME } from '../lib/utils'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Metas({ mes, ano }) {
  const { loading, metas, receitaTotal, despesasFixas, despesasVariaveis, saldoMes, salvarMeta, recarregar } = useFinanceiro(mes, ano)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ nome: '', emoji: '🎯', valor_total: '', ja_guardado: '', prazo_meses: '' })
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const ideal5030 = [
    { label: '🏠 Necessidades (50%)', pct: 0.5, realizado: despesasFixas, cor: 'var(--blue)' },
    { label: '🎭 Desejos (30%)', pct: 0.3, realizado: despesasVariaveis, cor: 'var(--yellow)' },
    { label: '💰 Poupança (20%)', pct: 0.2, realizado: Math.max(saldoMes, 0), cor: 'var(--green)' },
  ]

  const abrirNova = () => {
    setForm({ nome: '', emoji: '🎯', valor_total: '', ja_guardado: '', prazo_meses: '' })
    setModal('nova')
  }

  const abrirEditar = (m) => {
    setForm({ ...m, valor_total: m.valor_total, ja_guardado: m.ja_guardado, prazo_meses: m.prazo_meses })
    setModal('editar')
  }

  const salvar = async () => {
    setSaving(true)
    await salvarMeta({
      ...form,
      valor_total: parseFloat(form.valor_total) || 0,
      ja_guardado: parseFloat(form.ja_guardado) || 0,
      prazo_meses: parseInt(form.prazo_meses) || 0,
      ativa: true,
    })
    setSaving(false)
    setModal(null)
  }

  const excluir = async (id) => {
    await supabase.from('metas').update({ ativa: false }).eq('id', id)
    await recarregar()
  }

  const atualizarGuardado = async (meta, novoValor) => {
    await salvarMeta({ ...meta, ja_guardado: parseFloat(novoValor) || 0 })
  }

  return (
    <div>
      <div className="page-header">
        <h2>Metas</h2>
        <p>{MESES_NOME[mes-1]} {ano}</p>
      </div>

      {/* Regra 50-30-20 */}
      <div className="table-wrap mb-24">
        <div className="table-header"><h3>📏 Regra 50-30-20 — Saúde Financeira</h3></div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {ideal5030.map(r => {
              const ideal = receitaTotal * r.pct
              const pct = ideal > 0 ? Math.min(r.realizado / ideal, 1.5) : 0
              const ok = r.realizado <= ideal
              return (
                <div key={r.label} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 20 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>{r.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: ok ? 'var(--green)' : 'var(--red)' }}>
                    {fmt(r.realizado)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 10px' }}>Ideal: {fmt(ideal)}</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(pct * 100, 100)}%`, background: r.cor }} />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: ok ? 'var(--green)' : 'var(--red)', marginTop: 6 }}>
                    {ok ? `✓ Dentro do ideal (${fmtPct(pct)})` : `✗ Excedido em ${fmtPct(pct - 1)}`}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--green-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: 'var(--green)' }}>
            💰 Saldo disponível este mês: <strong>{fmt(saldoMes)}</strong>
            {saldoMes > 0 && <span className="text-muted" style={{ marginLeft: 8, color: 'var(--text-muted)' }}>({fmtPct(saldoMes / receitaTotal)} da receita)</span>}
          </div>
        </div>
      </div>

      {/* Metas */}
      <div className="flex-between mb-16">
        <div className="section-title" style={{ margin: 0 }}>Metas Financeiras</div>
        <button className="btn btn-primary btn-sm" onClick={abrirNova}><Plus size={14} /> Nova meta</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {metas.map(m => {
          const falta = Math.max(m.valor_total - m.ja_guardado, 0)
          const pct = m.valor_total > 0 ? m.ja_guardado / m.valor_total : 0
          const guardMes = m.prazo_meses > 0 ? falta / m.prazo_meses : 0
          return (
            <div key={m.id} className="card" style={{ borderTop: '2px solid var(--accent)' }}>
              <div className="flex-between mb-16">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.5rem' }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.nome}</div>
                    {m.prazo_meses > 0 && <div className="text-muted text-sm">{m.prazo_meses} meses</div>}
                  </div>
                </div>
                <div className="flex-center">
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditar(m)}><Edit2 size={13} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluir(m.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              {m.valor_total > 0 ? (
                <>
                  <div className="flex-between mb-4">
                    <span className="text-muted text-sm">Progresso</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>{fmtPct(pct)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(pct * 100, 100)}%`, background: 'var(--accent)' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                    <div>
                      <div className="text-muted text-sm">Total</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{fmt(m.valor_total)}</div>
                    </div>
                    <div>
                      <div className="text-muted text-sm">Guardado</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--green)' }}>{fmt(m.ja_guardado)}</div>
                    </div>
                    <div>
                      <div className="text-muted text-sm">Falta</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--red)' }}>{fmt(falta)}</div>
                    </div>
                    {guardMes > 0 && (
                      <div>
                        <div className="text-muted text-sm">Guardar/mês</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--yellow)' }}>{fmt(guardMes)}</div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-muted text-sm">Meta sem valor definido</div>
              )}
            </div>
          )
        })}

        {metas.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <Target className="icon" />
            <p>Nenhuma meta cadastrada ainda</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal === 'editar' ? 'Editar Meta' : 'Nova Meta'}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Nome da Meta</label>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Viagem dos sonhos" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Emoji</label>
                  <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🎯" />
                </div>
                <div className="form-group">
                  <label>Prazo (meses)</label>
                  <input type="number" value={form.prazo_meses} onChange={e => setForm(f => ({ ...f, prazo_meses: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Valor Total (R$)</label>
                  <input type="number" step="0.01" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Já Guardado (R$)</label>
                  <input type="number" step="0.01" value={form.ja_guardado} onChange={e => setForm(f => ({ ...f, ja_guardado: e.target.value }))} />
                </div>
              </div>
              {form.valor_total && form.prazo_meses && (
                <div className="card yellow" style={{ padding: 12 }}>
                  <div className="card-label">Precisará guardar por mês</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--yellow)' }}>
                    {fmt(Math.max(parseFloat(form.valor_total) - parseFloat(form.ja_guardado || 0), 0) / parseFloat(form.prazo_meses))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Target({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
}
