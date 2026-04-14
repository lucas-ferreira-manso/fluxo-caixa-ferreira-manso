import { useState, useRef } from 'react'
import { useFinanceiro, calcularMesCompetencia } from '../hooks/useFinanceiro'
import { fmt, fmtPct, CATEGORIAS, corStatus, MESES_NOME } from '../lib/utils'
import { Plus, Edit2, Trash2, Upload, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Mapeamento de palavras-chave para categorias
const MAPA_CATEGORIAS = {
  '🍽️ Alimentação': ['restauran', 'cafe', 'coffee', 'lanche', 'pizza', 'burger', 'sushi', 'ifood', 'rappi', 'delivery', 'padaria', 'armazem', 'savas', 'cultura primavera', 'quatro estacoes', 'primavera', 'fornetto'],
  '🛒 Supermercado': ['angeloni', 'mercado', 'supermercado', 'carrefour', 'atacadao', 'bistek', 'cbhomemarket', 'hortifrutti'],
  '🚗 Transporte': ['posto', 'combustivel', 'gasolina', 'uber', 'taxi', '99pop', 'estacionamento', 'pedagio', 'agua show', 'shell', 'ipiranga'],
  '🏥 Saúde': ['farmacia', 'raia', 'drogasil', 'panvel', 'droga', 'medico', 'clinica', 'hospital', 'laboratorio', 'exame', 'drogaria'],
  '📚 Educação': ['escola', 'colegio', 'faculdade', 'curso', 'udemy', 'alura', 'livro', 'livraria', 'santo antonio'],
  '🎭 Lazer': ['cinema', 'teatro', 'show', 'netflix', 'spotify', 'disney', 'hbo', 'prime', 'ingresso', 'playstation', 'steam', 'xbox', 'ebn'],
  '👗 Vestuário': ['riachuelo', 'renner', 'zara', 'hm', 'havan', 'decathlon', 'chillibeans', 'milium', 'shop floripa', 'shopping', 'iguatemi', 'sc floripa'],
  '📱 Assinaturas/Tech': ['google', 'apple', 'youtube', 'icloud', 'adobe', 'microsoft', 'amazon', 'dropbox', 'applecombill'],
  '🏠 Moradia': ['aluguel', 'condominio', 'agua', 'luz', 'energia', 'gas', 'limpeza', 'faxina', 'moveis', 'emporiodosofa', 'balaroti', 'mercadolivre', 'leroy', 'telhanorte', 'gralha', 'llz', 'one di'],
  '✈️ Viagem': ['gol', 'latam', 'azul', 'hotel', 'airbnb', 'booking', 'aerea', 'passagem'],
  '💆 Bem-estar': ['academia', 'pilates', 'yoga', 'spa', 'salao', 'barbearia', 'estetica', 'balarotti'],
  '🐾 Pet': ['pet', 'veterinario', 'animal', 'racao'],
}

function detectarCategoria(titulo) {
  const lower = titulo.toLowerCase()
  for (const [categoria, keywords] of Object.entries(MAPA_CATEGORIAS)) {
    if (keywords.some(kw => lower.includes(kw))) return categoria
  }
  return '🔧 Outros'
}

function gerarHash(date, title, amount) {
  return `nubank_fatura_${date}_${title.toLowerCase().replace(/\s+/g, '_').slice(0, 40)}_${amount}`
}

function parsearFaturaNubank(texto) {
  // Remove BOM se existir
  const clean = texto.replace(/^\uFEFF/, '').trim()
  const linhas = clean.split('\n')
  const itens = []
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim()
    if (!linha) continue
    const partes = linha.split(',')
    if (partes.length < 3) continue
    const date = partes[0].trim()
    const amount = parseFloat(partes[partes.length - 1].trim())
    const title = partes.slice(1, partes.length - 1).join(',').trim()
    if (!date || isNaN(amount) || amount <= 0) continue
    itens.push({ date, title, amount, hash: gerarHash(date, title, amount) })
  }
  return itens
}

export default function Cartao({ mes, ano }) {
  const {
    loading, lancamentos, cartoes, orcamentos,
    totalCartao, cartaoPorCategoria, salvarOrcamento,
    salvarCartao, excluirCartao, recarregar
  } = useFinanceiro(mes, ano)

  // Estados do gerenciamento de cartões
  const [editandoOrc, setEditandoOrc] = useState(null)
  const [novoOrc, setNovoOrc] = useState('')
  const [modalCartao, setModalCartao] = useState(null)
  const [formCartao, setFormCartao] = useState({ nome: '', dia_fechamento: 4, dia_vencimento: 11 })
  const [saving, setSaving] = useState(false)

  // Estados do importador de fatura
  const [abaAtiva, setAbaAtiva] = useState('resumo') // 'resumo' | 'importar'
  const [itens, setItens] = useState([])
  const [cartaoImportId, setCartaoImportId] = useState('')
  const [pessoaImport, setPessoaImport] = useState('Pessoa 1')
  const [importando, setImportando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [etapaImport, setEtapaImport] = useState('upload')
  const fileRef = useRef()

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

  const totalPorCartao = cartoes.map(c => ({
    ...c,
    total: lancamentos.filter(l => l.cartao_id === c.id).reduce((a, l) => a + l.valor, 0)
  }))

  // Lançamentos de cartão sem cartao_id vinculado (lançamentos antigos)
  const semCartaoVinculado = lancamentos.filter(l => !l.cartao_id && l.forma_pagamento === 'Cartão de Crédito').reduce((a, l) => a + l.valor, 0)

  // ---- Gerenciamento de cartões ----
  const salvarOrc = async (cat) => {
    await salvarOrcamento(cat, parseFloat(novoOrc) || 0)
    setEditandoOrc(null)
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

  // ---- Importador de fatura ----
  const verificarDuplicatas = async (itensParseados) => {
    setVerificando(true)
    const hashes = itensParseados.map(i => i.hash)
    const { data } = await supabase.from('lancamentos').select('importacao_hash').in('importacao_hash', hashes)
    const existentes = new Set((data || []).map(r => r.importacao_hash))
    const resultado = itensParseados.map(item => ({
      ...item,
      categoria: detectarCategoria(item.title),
      tipo: 'Despesa Variável',
      selecionado: !existentes.has(item.hash),
      jaExiste: existentes.has(item.hash),
    }))
    setVerificando(false)
    return resultado
  }

  const handleArquivo = async (file) => {
    if (!file) return
    const nubank = cartoes.find(c => c.nome.toLowerCase().includes('nubank'))
    setCartaoImportId(nubank?.id || cartoes[0]?.id || '')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const parsed = parsearFaturaNubank(ev.target.result)
      const comStatus = await verificarDuplicatas(parsed)
      setItens(comStatus)
      setEtapaImport('revisar')
    }
    reader.readAsText(file)
  }

  const importar = async () => {
    const selecionados = itens.filter(i => i.selecionado)
    if (!selecionados.length || !cartaoImportId) return
    setImportando(true)
    const cartao = cartoes.find(c => c.id === cartaoImportId)
    const lancamentosParaImportar = selecionados.map(item => {
      const comp = cartao ? calcularMesCompetencia(item.date, cartao.dia_fechamento) : { mes, ano }
      return {
        data: item.date,
        tipo: item.tipo,
        pessoa: pessoaImport,
        categoria: item.categoria,
        valor: item.amount,
        forma_pagamento: 'Cartão de Crédito',
        cartao_id: cartaoImportId || null,
        descricao: item.title,
        observacao: 'Importado do CSV Nubank',
        importacao_hash: item.hash,
        mes: comp.mes,
        ano: comp.ano,
      }
    })
    const { error } = await supabase.from('lancamentos').insert(lancamentosParaImportar)
    await recarregar()
    setImportando(false)
    setResultado({ total: lancamentosParaImportar.length, pulados: itens.filter(i => i.jaExiste).length, erro: error?.message })
    setEtapaImport('concluido')
  }

  const reiniciarImport = () => {
    setItens([])
    setResultado(null)
    setEtapaImport('upload')
    if (fileRef.current) fileRef.current.value = ''
  }

  const selecionados = itens.filter(i => i.selecionado)
  const jaExistem = itens.filter(i => i.jaExiste)
  const totalSelecionado = selecionados.reduce((a, i) => a + i.amount, 0)

  return (
    <div>
      <div className="page-header">
        <h2>Cartão de Crédito</h2>
        <p>{MESES_NOME[mes - 1]} {ano}</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--surface2)',
        borderRadius: 'var(--radius-sm)',
        padding: 4,
        marginBottom: 28,
        width: 'fit-content',
      }}>
        {[
          { id: 'resumo', label: '📊 Resumo & Cartões' },
          { id: 'importar', label: '📥 Importar Fatura CSV' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAbaAtiva(tab.id)}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: abaAtiva === tab.id ? 'var(--accent)' : 'transparent',
              color: abaAtiva === tab.id ? '#0f0f13' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ABA RESUMO */}
      {abaAtiva === 'resumo' && (
        <>
          {/* Cartões */}
          <div className="mb-24">
            <div className="flex-between mb-16">
              <div className="section-title" style={{ margin: 0 }}>Meus Cartões</div>
              <button className="btn btn-primary btn-sm" onClick={() => { setFormCartao({ nome: '', dia_fechamento: 4, dia_vencimento: 11 }); setModalCartao('novo') }}>
                <Plus size={14} /> Novo cartão
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {cartoes.map(c => {
                const totalC = totalPorCartao.find(t => t.id === c.id)?.total || 0
                return (
                  <div key={c.id} className="card purple">
                    <div className="flex-between mb-8">
                      <div style={{ fontWeight: 700 }}>💳 {c.nome}</div>
                      <div className="flex-center" style={{ gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setFormCartao({ nome: c.nome, dia_fechamento: c.dia_fechamento, dia_vencimento: c.dia_vencimento }); setModalCartao(c) }}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => excluirCartao(c.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--accent)' }}>{fmt(totalC)}</div>
                    <div className="text-muted text-sm mt-4">Fecha dia {c.dia_fechamento} · Vence dia {c.dia_vencimento}</div>
                  </div>
                )
              })}
              {semCartaoVinculado > 0 && (
                <div className="card yellow">
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>💳 Sem cartão vinculado</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--yellow)' }}>{fmt(semCartaoVinculado)}</div>
                  <div className="text-muted text-sm mt-4">Edite esses lançamentos para vincular ao cartão correto</div>
                </div>
              )}
              {cartoes.length === 0 && semCartaoVinculado === 0 && <div className="empty-state"><p>Nenhum cartão cadastrado</p></div>}
            </div>
          </div>

          {/* Tabela por categoria */}
          <div className="table-wrap">
            <div className="table-header">
              <h3>📂 Gastos por Categoria</h3>
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
                            <input type="number" step="0.01" value={novoOrc} onChange={e => setNovoOrc(e.target.value)}
                              style={{ width: 90, padding: '4px 6px', fontSize: '0.8rem' }} autoFocus />
                            <button className="btn btn-primary btn-sm" onClick={() => salvarOrc(cat)}>✓</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditandoOrc(null)}>×</button>
                          </div>
                        ) : (
                          <span style={{ cursor: 'pointer', color: 'var(--yellow)', textDecoration: 'underline dotted' }}
                            onClick={() => { setEditandoOrc(cat); setNovoOrc(orc) }}>
                            {orc > 0 ? fmt(orc) : '+ definir'}
                          </span>
                        )}
                      </td>
                      <td className="text-right">{real > 0 ? fmt(real) : '—'}</td>
                      <td className={`text-right ${diff >= 0 ? 'text-green' : 'text-red'}`}>{orc > 0 ? fmt(diff) : '—'}</td>
                      <td><span className={`badge ${cor}`}>{cor === 'green' ? '✓ OK' : cor === 'red' ? '✗ Excedido' : cor === 'yellow' ? '⚠ Atenção' : '—'}</span></td>
                      <td className="text-muted text-sm" style={{ maxWidth: 200 }}>{dicas[cat]}</td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--surface2)' }}>
                  <td><strong>TOTAL</strong></td>
                  <td className="text-right"><strong>{fmt(totalOrc)}</strong></td>
                  <td className="text-right"><strong>{fmt(totalReal)}</strong></td>
                  <td className={`text-right ${totalOrc - totalReal >= 0 ? 'text-green' : 'text-red'}`}><strong>{fmt(totalOrc - totalReal)}</strong></td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ABA IMPORTAR */}
      {abaAtiva === 'importar' && (
        <div>
          {/* Upload */}
          {etapaImport === 'upload' && (
            <div style={{ maxWidth: 560 }}>
              <div className="table-wrap mb-24">
                <div className="table-header"><h3>⚙️ Configurações</h3></div>
                <div style={{ padding: 20 }}>
                  <div className="form-group">
                    <label>Cartão</label>
                    <select value={cartaoImportId} onChange={e => setCartaoImportId(e.target.value)}>
                      {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Responsável</label>
                    <select value={pessoaImport} onChange={e => setPessoaImport(e.target.value)}>
                      <option>Pessoa 1</option>
                      <option>Esposa</option>
                      <option>Casal</option>
                    </select>
                  </div>
                </div>
              </div>
              <div
                style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleArquivo(e.dataTransfer.files[0]) }}
              >
                <Upload size={40} style={{ color: 'var(--accent)', margin: '0 auto 16px' }} />
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Arraste o CSV da fatura aqui</div>
                <div className="text-muted text-sm mb-16">ou clique para selecionar</div>
                <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', display: 'inline-block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Nubank: app → Cartão → Fatura → Exportar → CSV
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleArquivo(e.target.files[0])} />
              </div>
            </div>
          )}

          {verificando && <div className="loading"><div className="spinner" /> Verificando duplicatas...</div>}

          {/* Revisão */}
          {etapaImport === 'revisar' && !verificando && (
            <div>
              <div className="cards-grid mb-24">
                <div className="card purple"><div className="card-label">Total no arquivo</div><div className="card-value">{itens.length}</div></div>
                <div className="card green"><div className="card-label">Novos para importar</div><div className="card-value">{selecionados.length}</div></div>
                <div className="card yellow"><div className="card-label">Já existem (ignorados)</div><div className="card-value">{jaExistem.length}</div></div>
                <div className="card red"><div className="card-label">Total a importar</div><div className="card-value">{fmt(totalSelecionado)}</div></div>
              </div>

              {jaExistem.length > 0 && (
                <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: '0.82rem', color: 'var(--yellow)', marginBottom: 20 }}>
                  ⚠️ <strong>{jaExistem.length} transações</strong> já existem e foram desmarcadas automaticamente.
                </div>
              )}

              <div className="table-wrap mb-24">
                <div className="table-header">
                  <h3>Revise antes de importar</h3>
                  <div className="flex-center">
                    <button className="btn btn-ghost btn-sm" onClick={() => setItens(p => p.map(i => ({ ...i, selecionado: !i.jaExiste })))}>Selecionar novos</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setItens(p => p.map(i => ({ ...i, selecionado: false })))}>Desmarcar todos</button>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Tipo</th>
                      <th className="text-right">Valor</th>
                      <th>Fatura</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, i) => {
                      const cartao = cartoes.find(c => c.id === cartaoImportId)
                      const comp = cartao ? calcularMesCompetencia(item.date, cartao.dia_fechamento) : { mes, ano }
                      return (
                        <tr key={i} style={{ opacity: item.selecionado ? 1 : 0.4 }}>
                          <td><input type="checkbox" checked={item.selecionado} onChange={() => setItens(p => p.map((it, idx) => idx === i ? { ...it, selecionado: !it.selecionado } : it))} style={{ width: 'auto', cursor: 'pointer' }} /></td>
                          <td className="text-muted text-sm">{item.date}</td>
                          <td style={{ maxWidth: 180, fontSize: '0.82rem' }}>{item.title}</td>
                          <td>
                            <select value={item.categoria} onChange={e => setItens(p => p.map((it, idx) => idx === i ? { ...it, categoria: e.target.value } : it))}
                              style={{ padding: '4px 6px', fontSize: '0.78rem' }} disabled={item.jaExiste}>
                              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={item.tipo} onChange={e => setItens(p => p.map((it, idx) => idx === i ? { ...it, tipo: e.target.value } : it))}
                              style={{ padding: '4px 6px', fontSize: '0.78rem' }} disabled={item.jaExiste}>
                              <option>Despesa Fixa</option>
                              <option>Despesa Variável</option>
                            </select>
                          </td>
                          <td className="text-right text-red">{fmt(item.amount)}</td>
                          <td className="text-sm" style={{ color: 'var(--accent)' }}>{MESES_NOME[comp.mes - 1].slice(0, 3)} {comp.ano}</td>
                          <td>{item.jaExiste ? <span className="badge yellow">já existe</span> : <span className="badge green">novo</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex-center" style={{ justifyContent: 'flex-end', gap: 12 }}>
                <button className="btn btn-ghost" onClick={reiniciarImport}>Cancelar</button>
                <button className="btn btn-primary" onClick={importar} disabled={importando || selecionados.length === 0}>
                  {importando ? 'Importando...' : `Importar ${selecionados.length} lançamentos (${fmt(totalSelecionado)})`}
                </button>
              </div>
            </div>
          )}

          {/* Concluído */}
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
                  {resultado.pulados > 0 && <p className="text-muted text-sm mb-24">{resultado.pulados} já existiam e foram ignorados.</p>}
                </>
              )}
              <div className="flex-center" style={{ justifyContent: 'center', gap: 12, marginTop: 24 }}>
                <button className="btn btn-ghost" onClick={reiniciarImport}>Importar outro arquivo</button>
                <button className="btn btn-primary" onClick={() => setAbaAtiva('resumo')}>Ver Resumo</button>
              </div>
            </div>
          )}
        </div>
      )}

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
                <input value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Nubank, Inter..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Dia de fechamento</label>
                  <input type="number" min="1" max="31" value={formCartao.dia_fechamento} onChange={e => setFormCartao(f => ({ ...f, dia_fechamento: parseInt(e.target.value) }))} />
                  <div className="text-muted text-sm mt-4">Compras após este dia vão para a próxima fatura</div>
                </div>
                <div className="form-group">
                  <label>Dia de vencimento</label>
                  <input type="number" min="1" max="31" value={formCartao.dia_vencimento} onChange={e => setFormCartao(f => ({ ...f, dia_vencimento: parseInt(e.target.value) }))} />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalCartao(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarCartaoForm} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
