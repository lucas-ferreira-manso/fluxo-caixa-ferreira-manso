import { useState } from 'react'
import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, CATEGORIAS, FORMAS_PAG, TIPOS, MESES_NOME } from '../lib/utils'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const FORM_VAZIO = {
  data: '', tipo: 'Despesa Fixa', pessoa: '', categoria: CATEGORIAS[0],
  valor: '', forma_pagamento: 'Débito', descricao: '', observacao: ''
}

export default function Lancamentos({ mes, ano }) {
  const {
    loading, lancamentos, config,
    despesasFixas, despesasVariaveis, investimentos,
    totalDespesas, totalCartao, saldoMes, receitaTotal,
    adicionarLancamento, excluirLancamento, recarregar
  } = useFinanceiro(mes, ano)

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroCateg, setFiltroCateg] = useState('Todas')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const p1 = config.nome_pessoa1 || 'Pessoa 1'
  const p2 = config.nome_pessoa2 || 'Esposa'

  const filtrados = lancamentos.filter(l => {
    if (filtroTipo !== 'Todos' && l.tipo !== filtroTipo) return false
    if (filtroCateg !== 'Todas' && l.categoria !== filtroCateg) return false
    return true
  })

  const abrirNovo = () => {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModal(true)
  }

  const abrirEditar = (lancamento) => {
    setEditando(lancamento)
    setForm({
      data: lancamento.data || '',
      tipo: lancamento.tipo,
      pessoa: lancamento.pessoa,
      categoria: lancamento.categoria,
      valor: lancamento.valor,
      forma_pagamento: lancamento.forma_pagamento,
      descricao: lancamento.descricao || '',
      observacao: lancamento.observacao || '',
    })
    setModal(true)
  }

  const fecharModal = () => {
    setModal(false)
    setEditando(null)
    setForm(FORM_VAZIO)
  }

  const salvar = async () => {
    if (!form.categoria || !form.valor || !form.tipo || !form.forma_pagamento) return
    setSaving(true)

    if (editando) {
      await supabase
        .from('lancamentos')
        .update({
          data: form.data || null,
          tipo: form.tipo,
          pessoa: form.pessoa,
          categoria: form.categoria,
          valor: parseFloat(form.valor),
          forma_pagamento: form.forma_pagamento,
          descricao: form.descricao,
          observacao: form.observacao,
        })
        .eq('id', editando.id)
      await recarregar()
    } else {
      await adicionarLancamento({ ...form, valor: parseFloat(form.valor) })
    }

    setSaving(false)
    fecharModal()
  }

  const tipoCor = {
    'Despesa Fixa': 'red',
    'Despesa Variável': 'yellow',
    'Investimento': 'blue',
    'Receita': 'green'
  }

  return (
    <div>
      <div className="page-header">
        <h2>Lançamentos</h2>
        <p>{MESES_NOME[mes-1]} {ano}</p>
      </div>

      <div className="cards-grid mb-24">
        <div className="card green">
          <div className="card-label">Receita Total</div>
          <div className="card-value">{fmt(receitaTotal)}</div>
        </div>
        <div className="card red">
          <div className="card-label">Despesas Fixas</div>
          <div className="card-value">{fmt(despesasFixas)}</div>
        </div>
        <div className="card yellow">
          <div className="card-label">Despesas Variáveis</div>
          <div className="card-value">{fmt(despesasVariaveis)}</div>
        </div>
        <div className="card blue">
          <div className="card-label">Investimentos</div>
          <div className="card-value">{fmt(investimentos)}</div>
        </div>
        <div className="card purple">
          <div className="card-label">Total Cartão</div>
          <div className="card-value">{fmt(totalCartao)}</div>
        </div>
        <div className={`card ${saldoMes >= 0 ? 'green' : 'red'}`}>
          <div className="card-label">Saldo do Mês</div>
          <div className="card-value">{fmt(saldoMes)}</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <h3>📋 Tabela de Lançamentos ({filtrados.length})</h3>
          <div className="flex-center">
            <select
              className="mes-select"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
            >
              <option>Todos</option>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
            <select
              className="mes-select"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
              value={filtroCateg}
              onChange={e => setFiltroCateg(e.target.value)}
            >
              <option value="Todas">Todas categorias</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={abrirNovo}>
              <Plus size={14} /> Novo
            </button>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="empty-state">
            <Plus className="icon" />
            <p>Nenhum lançamento {filtroTipo !== 'Todos' || filtroCateg !== 'Todas' ? 'com estes filtros' : 'neste mês'}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Pessoa</th>
                <th>Categoria</th>
                <th>Descrição</th>
                <th>Pagamento</th>
                <th className="text-right">Valor</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(l => (
                <tr key={l.id}>
                  <td><span className={`badge ${tipoCor[l.tipo] || 'gray'}`}>{l.tipo}</span></td>
                  <td className="text-muted">{l.pessoa}</td>
                  <td>{l.categoria}</td>
                  <td>{l.descricao || '—'}</td>
                  <td>
                    <span className={`badge ${l.forma_pagamento === 'Cartão de Crédito' ? 'purple' : 'gray'}`}>
                      {l.forma_pagamento}
                    </span>
                  </td>
                  <td className="text-right text-red">{fmt(l.valor)}</td>
                  <td>
                    <div className="flex-center" style={{ justifyContent: 'center', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Editar"
                        onClick={() => abrirEditar(l)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        title="Excluir"
                        onClick={() => excluirLancamento(l.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editando ? '✏️ Editar Lançamento' : '+ Novo Lançamento'}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={fecharModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Pessoa</label>
                  <select value={form.pessoa} onChange={e => setForm(f => ({ ...f, pessoa: e.target.value }))}>
                    <option value="">Selecione</option>
                    <option>{p1}</option>
                    <option>{p2}</option>
                    <option>Casal</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Forma de Pagamento</label>
                  <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
                    {FORMAS_PAG.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Data (opcional)</label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descrição</label>
                <input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Aluguel, Netflix, Mercado..."
                />
              </div>

              <div className="form-group">
                <label>Observação</label>
                <input
                  value={form.observacao}
                  onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : editando ? '✓ Salvar alterações' : 'Salvar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
