import { useState, useEffect } from 'react'
import { fmt, MESES_NOME } from '../lib/utils'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EMOJIS = ['💰','📈','🏦','🪙','💎','🏠','📊','🌍','💵','🛡️','🎯','💼']

export default function Investimentos({ mes, ano }) {
  const [investimentos, setInvestimentos] = useState([])
  const [aportes, setAportes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalInv, setModalInv] = useState(null) // null | 'novo' | objeto
  const [modalAporte, setModalAporte] = useState(null) // null | investimento
  const [formInv, setFormInv] = useState({ nome: '', emoji: '💰', saldo_inicial: '' })
  const [formAporte, setFormAporte] = useState({ valor: '', observacao: '' })
  const [saving, setSaving] = useState(false)

  const carregar = async () => {
    setLoading(true)
    const [invRes, aportesRes] = await Promise.all([
      supabase.from('investimentos').select('*').eq('ativo', true).order('created_at'),
      supabase.from('aportes').select('*').order('created_at', { ascending: false }),
    ])
    setInvestimentos(invRes.data || [])
    setAportes(aportesRes.data || [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  // Soma todos os aportes de um investimento
  const totalAportado = (invId) => aportes.filter(a => a.investimento_id === invId).reduce((s, a) => s + a.valor, 0)

  // Saldo total = saldo_inicial + todos os aportes
  const saldoTotal = (inv) => inv.saldo_inicial + totalAportado(inv.id)

  // Totais gerais
  const patrimonioTotal = investimentos.reduce((s, inv) => s + saldoTotal(inv), 0)
  const totalSaldoInicial = investimentos.reduce((s, inv) => s + inv.saldo_inicial, 0)
  const totalTodosAportes = investimentos.reduce((s, inv) => s + totalAportado(inv.id), 0)

  // Aportes do mês atual
  const aportesDoMes = aportes.filter(a => a.mes === mes && a.ano === ano)
  const totalAportadoMes = aportesDoMes.reduce((s, a) => s + a.valor, 0)

  // ---- CRUD Investimento ----
  const salvarInvestimento = async () => {
    if (!formInv.nome) return
    setSaving(true)
    const dados = {
      nome: formInv.nome,
      emoji: formInv.emoji,
      saldo_inicial: parseFloat(formInv.saldo_inicial) || 0,
      ativo: true,
    }
    if (modalInv === 'novo') {
      await supabase.from('investimentos').insert([dados])
    } else {
      await supabase.from('investimentos').update(dados).eq('id', modalInv.id)
    }
    await carregar()
    setSaving(false)
    setModalInv(null)
  }

  const excluirInvestimento = async (id) => {
    await supabase.from('investimentos').update({ ativo: false }).eq('id', id)
    await carregar()
  }

  // ---- CRUD Aporte ----
  const salvarAporte = async () => {
    if (!formAporte.valor || !modalAporte) return
    setSaving(true)
    await supabase.from('aportes').insert([{
      investimento_id: modalAporte.id,
      valor: parseFloat(formAporte.valor),
      mes,
      ano,
      observacao: formAporte.observacao,
    }])
    await carregar()
    setSaving(false)
    setModalAporte(null)
    setFormAporte({ valor: '', observacao: '' })
  }

  const excluirAporte = async (id) => {
    await supabase.from('aportes').delete().eq('id', id)
    await carregar()
  }

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  return (
    <div>
      <div className="page-header">
        <h2>Investimentos</h2>
        <p>{MESES_NOME[mes - 1]} {ano}</p>
      </div>

      {/* Cards resumo */}
      <div className="cards-grid mb-24">
        <div className="card green">
          <div className="card-label">💰 Total Investido</div>
          <div className="card-value">{fmt(patrimonioTotal)}</div>
          <div className="card-sub">reserva + aportes</div>
        </div>
        <div className="card blue">
          <div className="card-label">🏦 Reserva inicial</div>
          <div className="card-value">{fmt(totalSaldoInicial)}</div>
          <div className="card-sub">o que já tinha antes</div>
        </div>
        <div className="card purple">
          <div className="card-label">📈 Total aportado</div>
          <div className="card-value">{fmt(totalTodosAportes)}</div>
          <div className="card-sub">todos os meses</div>
        </div>
        <div className="card yellow">
          <div className="card-label">📅 Aportado em {MESES_NOME[mes-1]}</div>
          <div className="card-value">{fmt(totalAportadoMes)}</div>
          <div className="card-sub">{aportesDoMes.length} aporte{aportesDoMes.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Lista de investimentos */}
      <div className="flex-between mb-16">
        <div className="section-title" style={{ margin: 0 }}>Onde estão meus investimentos</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setFormInv({ nome: '', emoji: '💰', saldo_inicial: '' }); setModalInv('novo') }}>
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        {investimentos.map(inv => {
          const saldo = saldoTotal(inv)
          const aportadoInv = totalAportado(inv.id)
          const aportadoMesInv = aportesDoMes.filter(a => a.investimento_id === inv.id).reduce((s, a) => s + a.valor, 0)
          const pct = patrimonioTotal > 0 ? saldo / patrimonioTotal : 0

          return (
            <div key={inv.id} className="card" style={{ borderTop: '2px solid var(--accent)' }}>
              <div className="flex-between mb-12">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.8rem' }}>{inv.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{inv.nome}</div>
                    <div className="text-muted text-sm">{(pct * 100).toFixed(1)}% do total</div>
                  </div>
                </div>
                <div className="flex-center" style={{ gap: 4 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setFormInv({ nome: inv.nome, emoji: inv.emoji, saldo_inicial: inv.saldo_inicial }); setModalInv(inv) }}>
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluirInvestimento(inv.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Total */}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--green)', marginBottom: 12 }}>
                {fmt(saldo)}
              </div>

              {/* Detalhes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  <div className="text-muted text-sm">Reserva inicial</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmt(inv.saldo_inicial)}</div>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
                  <div className="text-muted text-sm">Total aportado</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--blue)' }}>{fmt(aportadoInv)}</div>
                </div>
              </div>

              {/* Barra */}
              <div className="progress-bar mb-14">
                <div className="progress-fill" style={{ width: `${pct * 100}%`, background: 'var(--accent)' }} />
              </div>

              {/* Aporte do mês + botão */}
              <div className="flex-between">
                <div style={{ fontSize: '0.78rem', color: aportadoMesInv > 0 ? 'var(--green)' : 'var(--text-dim)' }}>
                  {aportadoMesInv > 0
                    ? `✓ ${fmt(aportadoMesInv)} em ${MESES_NOME[mes-1]}`
                    : `Sem aporte em ${MESES_NOME[mes-1]}`}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setModalAporte(inv); setFormAporte({ valor: '', observacao: '' }) }}>
                  <Plus size={12} /> Aportar
                </button>
              </div>
            </div>
          )
        })}

        {investimentos.length === 0 && (
          <div className="table-wrap" style={{ gridColumn: '1/-1' }}>
            <div className="empty-state">
              <p>Nenhum investimento cadastrado.<br />Clique em "Adicionar" para começar.</p>
            </div>
          </div>
        )}
      </div>

      {/* Histórico de aportes do mês */}
      {aportesDoMes.length > 0 && (
        <div className="table-wrap">
          <div className="table-header">
            <h3>📋 Aportes de {MESES_NOME[mes-1]} {ano}</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Investimento</th>
                <th>Observação</th>
                <th className="text-right">Valor</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {aportesDoMes.map(ap => {
                const inv = investimentos.find(i => i.id === ap.investimento_id)
                return (
                  <tr key={ap.id}>
                    <td><span style={{ marginRight: 8 }}>{inv?.emoji}</span><strong>{inv?.nome || '—'}</strong></td>
                    <td className="text-muted">{ap.observacao || '—'}</td>
                    <td className="text-right text-green">{fmt(ap.valor)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluirAporte(ap.id)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--surface2)' }}>
                <td colSpan={2}><strong>Total no mês</strong></td>
                <td className="text-right"><strong className="text-green">{fmt(totalAportadoMes)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Modal investimento */}
      {modalInv && (
        <div className="modal-overlay" onClick={() => setModalInv(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modalInv === 'novo' ? '+ Novo Investimento' : `✏️ Editar ${modalInv.nome}`}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalInv(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nome</label>
                <input value={formInv.nome} onChange={e => setFormInv(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: XP Investimentos, Nubank Reserva..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Ícone</label>
                  <select value={formInv.emoji} onChange={e => setFormInv(f => ({ ...f, emoji: e.target.value }))}>
                    {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Saldo que já tenho hoje (R$)</label>
                  <input type="number" step="0.01" value={formInv.saldo_inicial} onChange={e => setFormInv(f => ({ ...f, saldo_inicial: e.target.value }))} placeholder="0,00" />
                </div>
              </div>
              <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--blue)' }}>
                ℹ️ Coloque o saldo que você já tem hoje. Os aportes mensais serão somados a partir de agora.
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalInv(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarInvestimento} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal aporte */}
      {modalAporte && (
        <div className="modal-overlay" onClick={() => setModalAporte(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modalAporte.emoji} Aporte em {modalAporte.nome}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalAporte(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16 }}>
                <div className="text-muted text-sm">Saldo atual</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--green)' }}>
                  {fmt(saldoTotal(modalAporte))}
                </div>
              </div>
              <div className="form-group">
                <label>Valor do aporte (R$)</label>
                <input type="number" step="0.01" min="0" value={formAporte.valor} onChange={e => setFormAporte(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" autoFocus />
              </div>
              <div className="form-group">
                <label>Observação (opcional)</label>
                <input value={formAporte.observacao} onChange={e => setFormAporte(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: aporte mensal..." />
              </div>
              {formAporte.valor && (
                <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--green)' }}>
                  ✓ Novo saldo após aporte: <strong>{fmt(saldoTotal(modalAporte) + (parseFloat(formAporte.valor) || 0))}</strong>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalAporte(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarAporte} disabled={saving}>
                {saving ? 'Salvando...' : `Confirmar ${fmt(parseFloat(formAporte.valor) || 0)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
