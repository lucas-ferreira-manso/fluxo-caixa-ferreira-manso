import { useState, useRef } from 'react'
import { useFinanceiro, calcularMesCompetencia } from '../hooks/useFinanceiro'
import { fmt, CATEGORIAS, FORMAS_PAG, TIPOS, MESES_NOME } from '../lib/utils'
import { Plus, Trash2, Edit2, CreditCard, Upload, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const FORM_VAZIO = {
  data: '', tipo: 'Despesa Fixa', pessoa: '', categoria: CATEGORIAS[0],
  valor: '', forma_pagamento: 'Débito', cartao_id: '', descricao: '', observacao: ''
}

// Mapeamento para o extrato bancário
const MAPA_CATEGORIAS = {
  '🍽️ Alimentação': ['restauran', 'cafe', 'coffee', 'lanche', 'pizza', 'burger', 'sushi', 'ifood', 'rappi', 'delivery', 'padaria', 'armazem', 'savas', 'cultura primavera', 'quatro estacoes', 'primavera', 'fornetto'],
  '🛒 Supermercado': ['angeloni', 'mercado', 'supermercado', 'carrefour', 'atacadao', 'bistek', 'cbhomemarket', 'hortifrutti'],
  '🚗 Transporte': ['posto', 'combustivel', 'gasolina', 'uber', 'taxi', '99pop', 'estacionamento', 'agua show', 'shell', 'ipiranga', 'honda'],
  '🏥 Saúde': ['farmacia', 'raia', 'drogasil', 'panvel', 'droga', 'medico', 'clinica', 'hospital', 'laboratorio', 'exame'],
  '📚 Educação': ['escola', 'colegio', 'faculdade', 'curso', 'udemy', 'alura', 'livro', 'livraria', 'santo antonio'],
  '🎭 Lazer': ['cinema', 'teatro', 'show', 'netflix', 'spotify', 'disney', 'hbo', 'prime', 'ingresso', 'playstation'],
  '👗 Vestuário': ['riachuelo', 'renner', 'zara', 'hm', 'havan', 'decathlon', 'chillibeans', 'milium', 'shopping', 'iguatemi'],
  '📱 Assinaturas/Tech': ['google', 'apple', 'youtube', 'icloud', 'adobe', 'microsoft', 'amazon', 'dropbox'],
  '🏠 Moradia': ['aluguel', 'condominio', 'agua', 'luz', 'energia', 'gas', 'limpeza', 'faxina', 'moveis', 'balaroti', 'leroy', 'gralha', 'llz', 'celesc', 'supergasbras', 'one di'],
  '✈️ Viagem': ['gol', 'latam', 'azul', 'hotel', 'airbnb', 'booking', 'aerea', 'passagem'],
  '💆 Bem-estar': ['academia', 'pilates', 'yoga', 'spa', 'salao', 'barbearia', 'estetica'],
  '🐾 Pet': ['pet', 'veterinario', 'animal', 'racao'],
}

function detectarCategoria(descricao) {
  const lower = descricao.toLowerCase()
  for (const [categoria, keywords] of Object.entries(MAPA_CATEGORIAS)) {
    if (keywords.some(kw => lower.includes(kw))) return categoria
  }
  return '🔧 Outros'
}

function detectarFormaPagamento(descricao) {
  const lower = descricao.toLowerCase()
  if (lower.includes('pix')) return 'Pix'
  if (lower.includes('boleto')) return 'Boleto'
  if (lower.includes('débito') || lower.includes('debito')) return 'Débito'
  if (lower.includes('transferência') || lower.includes('transferencia')) return 'Transferência'
  return 'Débito'
}

function parsearExtratoNubank(texto) {
  const clean = texto.replace(/^\uFEFF/, '').trim()
  const linhas = clean.split('\n')
  const itens = []
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim()
    if (!linha) continue
    // Formato: Data,Valor,Identificador,Descrição
    const partes = linha.split(',')
    if (partes.length < 4) continue
    const data = partes[0].trim() // dd/mm/yyyy
    const valor = parseFloat(partes[1].trim())
    const identificador = partes[2].trim()
    const descricao = partes.slice(3).join(',').trim()

    if (!data || isNaN(valor)) continue

    // Converte data de dd/mm/yyyy para yyyy-mm-dd
    const [dia, mesStr, anoStr] = data.split('/')
    const dataISO = `${anoStr}-${mesStr}-${dia}`

    // Ignora entradas (valores positivos) exceto se for relevante
    // Ignora pagamento de fatura (isso já está no cartão)
    if (descricao.toLowerCase().includes('pagamento de fatura')) continue

    itens.push({
      data: dataISO,
      dataOriginal: data,
      valor: Math.abs(valor),
      isEntrada: valor > 0,
      identificador,
      descricao,
    })
  }
  return itens
}

export default function Lancamentos({ mes, ano }) {
  const {
    loading, lancamentos, config, cartoes,
    despesasFixas, despesasVariaveis, investimentos,
    totalDespesas, totalCartao, saldoMes, receitaTotal,
    adicionarLancamento, excluirLancamento, recarregar
  } = useFinanceiro(mes, ano)

  const [abaAtiva, setAbaAtiva] = useState('lancamentos')
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroCateg, setFiltroCateg] = useState('Todas')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)

  // Estados do importador de extrato
  const [itensExtrato, setItensExtrato] = useState([])
  const [pessoaExtrato, setPessoaExtrato] = useState('Lucas')
  const [importando, setImportando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [etapaImport, setEtapaImport] = useState('upload')
  const fileRef = useRef()

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const p1 = config.nome_pessoa1 || 'Lucas'
  const p2 = config.nome_pessoa2 || 'Lais'

  const filtrados = lancamentos.filter(l => {
    if (filtroTipo !== 'Todos' && l.tipo !== filtroTipo) return false
    if (filtroCateg !== 'Todas' && l.categoria !== filtroCateg) return false
    return true
  })

  // ---- Modal de lançamento manual ----
  const abrirNovo = () => { setEditandoId(null); setForm(FORM_VAZIO); setModal(true) }

  const abrirEditar = (l) => {
    setEditandoId(l.id)
    setForm({
      data: l.data || '',
      tipo: l.tipo || 'Despesa Fixa',
      pessoa: l.pessoa || '',
      categoria: l.categoria || CATEGORIAS[0],
      valor: l.valor || '',
      forma_pagamento: l.cartao_id ? 'Cartão de Crédito' : (l.forma_pagamento || 'Débito'),
      cartao_id: l.cartao_id || '',
      descricao: l.descricao || '',
      observacao: l.observacao || '',
    })
    setModal(true)
  }

  const fecharModal = () => { setModal(false); setEditandoId(null); setForm(FORM_VAZIO) }

  const previewMesCartao = () => {
    if (!form.cartao_id) return null
    const cartao = cartoes.find(c => c.id === form.cartao_id)
    if (!cartao) return null
    const dataRef = form.data || new Date().toISOString().slice(0, 10)
    const comp = calcularMesCompetencia(dataRef, cartao.dia_fechamento)
    return `${MESES_NOME[comp.mes - 1]} ${comp.ano}`
  }

  const salvar = async () => {
    if (!form.categoria || !form.valor || !form.tipo) return
    setSaving(true)
    const cartao = form.cartao_id ? cartoes.find(c => c.id === form.cartao_id) : null
    let mesComp = mes, anoComp = ano
    if (cartao) {
      const dataRef = form.data || new Date().toISOString().slice(0, 10)
      const comp = calcularMesCompetencia(dataRef, cartao.dia_fechamento)
      mesComp = comp.mes; anoComp = comp.ano
    }
    const dados = {
      data: form.data || null, tipo: form.tipo, pessoa: form.pessoa,
      categoria: form.categoria, valor: parseFloat(form.valor),
      forma_pagamento: form.cartao_id ? 'Cartão de Crédito' : form.forma_pagamento,
      cartao_id: form.cartao_id || null,
      descricao: form.descricao, observacao: form.observacao,
      mes: mesComp, ano: anoComp,
    }
    if (editandoId) {
      await supabase.from('lancamentos').update(dados).eq('id', editandoId)
    } else {
      await supabase.from('lancamentos').insert([dados])
    }
    await recarregar()
    setSaving(false)
    fecharModal()
  }

  // ---- Importador de extrato ----
  const verificarDuplicatasExtrato = async (itensParseados) => {
    setVerificando(true)
    const ids = itensParseados.map(i => `extrato_${i.identificador}`)
    const { data } = await supabase.from('lancamentos').select('importacao_hash').in('importacao_hash', ids)
    const existentes = new Set((data || []).map(r => r.importacao_hash))
    const resultado = itensParseados.map(item => ({
      ...item,
      categoria: item.isEntrada ? '💰 Salário/Receita' : detectarCategoria(item.descricao),
      tipo: item.isEntrada ? 'Receita' : 'Despesa Variável',
      formaPagamento: detectarFormaPagamento(item.descricao),
      hash: `extrato_${item.identificador}`,
      selecionado: !existentes.has(`extrato_${item.identificador}`) && !item.isEntrada,
      jaExiste: existentes.has(`extrato_${item.identificador}`),
    }))
    setVerificando(false)
    return resultado
  }

  const handleArquivoExtrato = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const parsed = parsearExtratoNubank(ev.target.result)
      const comStatus = await verificarDuplicatasExtrato(parsed)
      setItensExtrato(comStatus)
      setEtapaImport('revisar')
    }
    reader.readAsText(file)
  }

  const importarExtrato = async () => {
    const selecionados = itensExtrato.filter(i => i.selecionado)
    if (!selecionados.length) return
    setImportando(true)

    // Calcula mês/ano a partir da data do lançamento
    const lancamentosParaImportar = selecionados.map(item => {
      const [anoStr, mesStr] = item.data.split('-')
      return {
        data: item.data,
        tipo: item.tipo,
        pessoa: pessoaExtrato,
        categoria: item.categoria,
        valor: item.valor,
        forma_pagamento: item.formaPagamento,
        cartao_id: null,
        descricao: item.descricao,
        observacao: 'Importado do extrato Nubank',
        importacao_hash: item.hash,
        mes: parseInt(mesStr),
        ano: parseInt(anoStr),
      }
    })

    const { error } = await supabase.from('lancamentos').insert(lancamentosParaImportar)
    await recarregar()
    setImportando(false)
    setResultado({ total: lancamentosParaImportar.length, pulados: itensExtrato.filter(i => i.jaExiste).length, erro: error?.message })
    setEtapaImport('concluido')
  }

  const reiniciarImport = () => {
    setItensExtrato([])
    setResultado(null)
    setEtapaImport('upload')
    if (fileRef.current) fileRef.current.value = ''
  }

  const selecionadosExtrato = itensExtrato.filter(i => i.selecionado)
  const jaExistemExtrato = itensExtrato.filter(i => i.jaExiste)
  const totalSelecionadoExtrato = selecionadosExtrato.reduce((a, i) => a + i.valor, 0)

  const tipoCor = { 'Despesa Fixa': 'red', 'Despesa Variável': 'yellow', 'Investimento': 'blue', 'Receita': 'green' }
  const nomeCartao = (id) => cartoes.find(c => c.id === id)?.nome || 'Cartão'

  return (
    <div>
      <div className="page-header">
        <h2>Lançamentos</h2>
        <p>{MESES_NOME[mes - 1]} {ano}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 28, width: 'fit-content' }}>
        {[
          { id: 'lancamentos', label: '📋 Lançamentos' },
          { id: 'importar', label: '📥 Importar Extrato CSV' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setAbaAtiva(tab.id)} style={{
            padding: '8px 18px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: abaAtiva === tab.id ? 'var(--accent)' : 'transparent',
            color: abaAtiva === tab.id ? '#0f0f13' : 'var(--text-muted)',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ABA LANÇAMENTOS */}
      {abaAtiva === 'lancamentos' && (
        <>
          <div className="cards-grid mb-24">
            <div className="card green"><div className="card-label">Receita Total</div><div className="card-value">{fmt(receitaTotal)}</div></div>
            <div className="card red"><div className="card-label">Despesas Fixas</div><div className="card-value">{fmt(despesasFixas)}</div></div>
            <div className="card yellow"><div className="card-label">Despesas Variáveis</div><div className="card-value">{fmt(despesasVariaveis)}</div></div>
            <div className="card blue"><div className="card-label">Investimentos</div><div className="card-value">{fmt(investimentos)}</div></div>
            <div className="card purple"><div className="card-label">Total Cartão</div><div className="card-value">{fmt(totalCartao)}</div></div>
            <div className={`card ${saldoMes >= 0 ? 'green' : 'red'}`}><div className="card-label">Saldo do Mês</div><div className="card-value">{fmt(saldoMes)}</div></div>
          </div>

          <div className="table-wrap">
            <div className="table-header">
              <h3>📋 Lançamentos ({filtrados.length})</h3>
              <div className="flex-center">
                <select className="mes-select" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                  <option>Todos</option>
                  {TIPOS.map(t => <option key={t}>{t}</option>)}
                </select>
                <select className="mes-select" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }} value={filtroCateg} onChange={e => setFiltroCateg(e.target.value)}>
                  <option value="Todas">Todas categorias</option>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={abrirNovo}><Plus size={14} /> Novo</button>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div className="empty-state"><p>Nenhum lançamento neste mês</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th><th>Pessoa</th><th>Categoria</th><th>Descrição</th><th>Pagamento</th>
                    <th className="text-right">Valor</th><th style={{ textAlign: 'center' }}>Ações</th>
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
                        {l.cartao_id
                          ? <span className="badge purple"><CreditCard size={10} /> {nomeCartao(l.cartao_id)}</span>
                          : <span className="badge gray">{l.forma_pagamento}</span>}
                      </td>
                      <td className="text-right text-red">{fmt(l.valor)}</td>
                      <td>
                        <div className="flex-center" style={{ justifyContent: 'center', gap: 6 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => abrirEditar(l)}><Edit2 size={13} /></button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluirLancamento(l.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ABA IMPORTAR EXTRATO */}
      {abaAtiva === 'importar' && (
        <div>
          {etapaImport === 'upload' && (
            <div style={{ maxWidth: 560 }}>
              <div className="table-wrap mb-24">
                <div className="table-header"><h3>⚙️ Configurações</h3></div>
                <div style={{ padding: 20 }}>
                  <div className="form-group">
                    <label>Responsável pela conta</label>
                    <select value={pessoaExtrato} onChange={e => setPessoaExtrato(e.target.value)}>
                      <option>{p1}</option>
                      <option>{p2}</option>
                      <option>Casal</option>
                    </select>
                  </div>
                  <div style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--blue)' }}>
                    ℹ️ Entradas (recebimentos) serão desmarcadas por padrão. Pagamentos de fatura são ignorados automaticamente.
                  </div>
                </div>
              </div>
              <div
                style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleArquivoExtrato(e.dataTransfer.files[0]) }}
              >
                <Upload size={40} style={{ color: 'var(--blue)', margin: '0 auto 16px' }} />
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Arraste o CSV do extrato aqui</div>
                <div className="text-muted text-sm mb-16">ou clique para selecionar</div>
                <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', display: 'inline-block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Nubank: app → Conta → Extrato → Exportar → CSV
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleArquivoExtrato(e.target.files[0])} />
              </div>
            </div>
          )}

          {verificando && <div className="loading"><div className="spinner" /> Verificando duplicatas...</div>}

          {etapaImport === 'revisar' && !verificando && (
            <div>
              <div className="cards-grid mb-24">
                <div className="card purple"><div className="card-label">Total no arquivo</div><div className="card-value">{itensExtrato.length}</div></div>
                <div className="card green"><div className="card-label">Selecionados</div><div className="card-value">{selecionadosExtrato.length}</div></div>
                <div className="card yellow"><div className="card-label">Já existem</div><div className="card-value">{jaExistemExtrato.length}</div></div>
                <div className="card red"><div className="card-label">Total a importar</div><div className="card-value">{fmt(totalSelecionadoExtrato)}</div></div>
              </div>

              {jaExistemExtrato.length > 0 && (
                <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: '0.82rem', color: 'var(--yellow)', marginBottom: 20 }}>
                  ⚠️ <strong>{jaExistemExtrato.length} transações</strong> já existem e foram desmarcadas automaticamente.
                </div>
              )}

              <div className="table-wrap mb-24">
                <div className="table-header">
                  <h3>Revise antes de importar</h3>
                  <div className="flex-center">
                    <button className="btn btn-ghost btn-sm" onClick={() => setItensExtrato(p => p.map(i => ({ ...i, selecionado: !i.jaExiste && !i.isEntrada })))}>Selecionar saídas</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setItensExtrato(p => p.map(i => ({ ...i, selecionado: false })))}>Desmarcar todos</button>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Pagamento</th>
                      <th className="text-right">Valor</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensExtrato.map((item, i) => (
                      <tr key={i} style={{ opacity: item.selecionado ? 1 : 0.4 }}>
                        <td><input type="checkbox" checked={item.selecionado} onChange={() => setItensExtrato(p => p.map((it, idx) => idx === i ? { ...it, selecionado: !it.selecionado } : it))} style={{ width: 'auto', cursor: 'pointer' }} /></td>
                        <td className="text-muted text-sm">{item.dataOriginal}</td>
                        <td style={{ maxWidth: 200, fontSize: '0.78rem' }}>{item.descricao}</td>
                        <td>
                          <select value={item.categoria} onChange={e => setItensExtrato(p => p.map((it, idx) => idx === i ? { ...it, categoria: e.target.value } : it))}
                            style={{ padding: '4px 6px', fontSize: '0.75rem' }} disabled={item.jaExiste}>
                            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={item.tipo} onChange={e => setItensExtrato(p => p.map((it, idx) => idx === i ? { ...it, tipo: e.target.value } : it))}
                            style={{ padding: '4px 6px', fontSize: '0.75rem' }} disabled={item.jaExiste}>
                            <option>Despesa Fixa</option>
                            <option>Despesa Variável</option>
                            <option>Receita</option>
                            <option>Investimento</option>
                          </select>
                        </td>
                        <td><span className="badge gray" style={{ fontSize: '0.7rem' }}>{item.formaPagamento}</span></td>
                        <td className={`text-right ${item.isEntrada ? 'text-green' : 'text-red'}`}>{item.isEntrada ? '+' : ''}{fmt(item.valor)}</td>
                        <td>{item.jaExiste ? <span className="badge yellow">já existe</span> : item.isEntrada ? <span className="badge green">entrada</span> : <span className="badge blue">novo</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex-center" style={{ justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-ghost" onClick={reiniciarImport}>Cancelar</button>
                <button className="btn btn-primary" onClick={importarExtrato} disabled={importando || selecionadosExtrato.length === 0}>
                  {importando ? 'Importando...' : `Importar ${selecionadosExtrato.length} lançamentos (${fmt(totalSelecionadoExtrato)})`}
                </button>
              </div>
            </div>
          )}

          {etapaImport === 'concluido' && (
            <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
              {resultado?.erro ? (
                <>
                  <AlertCircle size={56} style={{ color: 'var(--red)', margin: '0 auto 20px' }} />
                  <h3 style={{ marginBottom: 8 }}>Erro na importação</h3>
                  <p className="text-muted text-sm mb-24">{resultado.erro}</p>
                </>
              ) : (
                <>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Check size={36} style={{ color: 'var(--green)' }} />
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 8 }}>Importação concluída!</h3>
                  <p className="text-muted mb-8"><strong style={{ color: 'var(--green)' }}>{resultado.total} lançamentos</strong> importados com sucesso.</p>
                  {resultado.pulados > 0 && <p className="text-muted text-sm">{resultado.pulados} já existiam e foram ignorados.</p>}
                </>
              )}
              <div className="flex-center" style={{ justifyContent: 'center', gap: 12, marginTop: 24 }}>
                <button className="btn btn-ghost" onClick={reiniciarImport}>Importar outro arquivo</button>
                <button className="btn btn-primary" onClick={() => setAbaAtiva('lancamentos')}>Ver Lançamentos</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal lançamento manual */}
      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editandoId ? '✏️ Editar Lançamento' : '+ Novo Lançamento'}</h3>
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
                    <option>{p1}</option><option>{p2}</option><option>Casal</option>
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
                  <input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Forma de Pagamento</label>
                <select value={form.cartao_id ? 'cartao' : form.forma_pagamento}
                  onChange={e => {
                    if (e.target.value === 'cartao') {
                      setForm(f => ({ ...f, forma_pagamento: 'Cartão de Crédito', cartao_id: cartoes[0]?.id || '' }))
                    } else {
                      setForm(f => ({ ...f, forma_pagamento: e.target.value, cartao_id: '' }))
                    }
                  }}>
                  <option value="Débito">Débito</option>
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Boleto">Boleto</option>
                  {cartoes.length > 0 && <option value="cartao">Cartão de Crédito</option>}
                </select>
              </div>
              {form.cartao_id !== '' && cartoes.length > 0 && (
                <div className="form-group">
                  <label>Qual cartão?</label>
                  <select value={form.cartao_id} onChange={e => setForm(f => ({ ...f, cartao_id: e.target.value }))}>
                    {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome} (fecha dia {c.dia_fechamento})</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Data {form.cartao_id ? '(importante para calcular a fatura)' : '(opcional)'}</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              {form.cartao_id && (
                <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--accent)', marginBottom: 16 }}>
                  💳 Este gasto vai entrar na fatura de <strong>{previewMesCartao()}</strong>
                </div>
              )}
              <div className="form-group">
                <label>Descrição</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel, Netflix..." />
              </div>
              <div className="form-group">
                <label>Observação</label>
                <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={saving}>
                {saving ? 'Salvando...' : editandoId ? '✓ Salvar alterações' : 'Salvar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
