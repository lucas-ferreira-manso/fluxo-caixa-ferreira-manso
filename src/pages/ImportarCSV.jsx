import { useState, useRef, useEffect } from 'react'
import { useFinanceiro, calcularMesCompetencia } from '../hooks/useFinanceiro'
import { fmt, CATEGORIAS, MESES_NOME } from '../lib/utils'
import { Upload, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const MAPA_CATEGORIAS = {
  '🍽️ Alimentação': ['restauran', 'cafe', 'coffee', 'lanche', 'pizza', 'burger', 'sushi', 'ifood', 'rappi', 'delivery', 'padaria', 'armazem', 'savas', 'cultura primavera', 'quatro estacoes', 'primavera'],
  '🛒 Supermercado': ['angeloni', 'mercado', 'supermercado', 'carrefour', 'atacadao', 'bistek', 'cbhomemarket', 'hortifrutti', 'hortifruti'],
  '🚗 Transporte': ['posto', 'combustivel', 'gasolina', 'uber', 'taxi', '99pop', 'estacionamento', 'pedagio', 'agua show', 'shell', 'ipiranga'],
  '🏥 Saúde': ['farmacia', 'raia', 'drogasil', 'panvel', 'droga', 'medico', 'clinica', 'hospital', 'laboratorio', 'exame', 'drogaria'],
  '📚 Educação': ['escola', 'colegio', 'faculdade', 'curso', 'udemy', 'alura', 'livro', 'livraria'],
  '🎭 Lazer': ['cinema', 'teatro', 'show', 'netflix', 'spotify', 'disney', 'hbo', 'prime', 'ingresso', 'playstation', 'steam', 'xbox', 'ebn'],
  '👗 Vestuário': ['riachuelo', 'renner', 'zara', 'hm', 'havan', 'decathlon', 'chillibeans', 'milium', 'shop floripa', 'shopping', 'iguatemi', 'sc floripa'],
  '📱 Assinaturas/Tech': ['google', 'apple', 'youtube', 'icloud', 'adobe', 'microsoft', 'amazon', 'dropbox', 'dl*google', 'applecombill'],
  '🏠 Moradia': ['aluguel', 'condominio', 'agua', 'luz', 'energia', 'gas', 'limpeza', 'faxina', 'moveis', 'emporiodosofa', 'balaroti', 'mercadolivre', 'leroy', 'telhanorte'],
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
  // Hash simples e determinístico: data+titulo+valor
  return `nubank_${date}_${title.toLowerCase().replace(/\s+/g, '_')}_${amount}`
}

function parsearCSVNubank(texto) {
  const linhas = texto.trim().split('\n')
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
    itens.push({
      date,
      title,
      amount,
      hash: gerarHash(date, title, amount),
    })
  }
  return itens
}

export default function ImportarCSV({ mes, ano }) {
  const { cartoes, recarregar } = useFinanceiro(mes, ano)
  const [itens, setItens] = useState([])
  const [cartaoId, setCartaoId] = useState('')
  const [pessoa, setPessoa] = useState('Pessoa 1')
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [etapa, setEtapa] = useState('upload')
  const [verificando, setVerificando] = useState(false)
  const fileRef = useRef()

  const nubank = cartoes.find(c => c.nome.toLowerCase().includes('nubank'))

  // Verifica quais hashes já existem no banco
  const verificarDuplicatas = async (itensParseados) => {
    setVerificando(true)
    const hashes = itensParseados.map(i => i.hash)
    const { data } = await supabase
      .from('lancamentos')
      .select('importacao_hash')
      .in('importacao_hash', hashes)

    const hashesExistentes = new Set((data || []).map(r => r.importacao_hash))

    const comStatus = itensParseados.map(item => ({
      ...item,
      categoria: detectarCategoria(item.title),
      tipo: 'Despesa Variável',
      selecionado: !hashesExistentes.has(item.hash), // desmarca os já existentes
      jaExiste: hashesExistentes.has(item.hash),
    }))

    setVerificando(false)
    return comStatus
  }

  const handleArquivo = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const parsed = parsearCSVNubank(ev.target.result)
      setCartaoId(nubank?.id || cartoes[0]?.id || '')
      const comStatus = await verificarDuplicatas(parsed)
      setItens(comStatus)
      setEtapa('revisar')
    }
    reader.readAsText(file)
  }

  const toggleItem = (i) => {
    setItens(prev => prev.map((item, idx) => idx === i ? { ...item, selecionado: !item.selecionado } : item))
  }

  const alterarCategoria = (i, cat) => {
    setItens(prev => prev.map((item, idx) => idx === i ? { ...item, categoria: cat } : item))
  }

  const alterarTipo = (i, tipo) => {
    setItens(prev => prev.map((item, idx) => idx === i ? { ...item, tipo } : item))
  }

  const importar = async () => {
    const selecionados = itens.filter(i => i.selecionado)
    if (!selecionados.length || !cartaoId) return
    setImportando(true)

    const cartao = cartoes.find(c => c.id === cartaoId)
    const lancamentos = selecionados.map(item => {
      const comp = cartao
        ? calcularMesCompetencia(item.date, cartao.dia_fechamento)
        : { mes, ano }
      return {
        data: item.date,
        tipo: item.tipo,
        pessoa,
        categoria: item.categoria,
        valor: item.amount,
        forma_pagamento: 'Cartão de Crédito',
        cartao_id: cartaoId || null,
        descricao: item.title,
        observacao: 'Importado do CSV Nubank',
        importacao_hash: item.hash,
        mes: comp.mes,
        ano: comp.ano,
      }
    })

    // upsert: se o hash já existir, atualiza; se não existir, insere
    const { error } = await supabase
      .from('lancamentos')
      .upsert(lancamentos, { onConflict: 'importacao_hash', ignoreDuplicates: true })

    await recarregar()
    setImportando(false)
    setResultado({
      total: lancamentos.length,
      pulados: itens.filter(i => i.jaExiste).length,
      erro: error?.message
    })
    setEtapa('concluido')
  }

  const reiniciar = () => {
    setItens([])
    setResultado(null)
    setEtapa('upload')
    if (fileRef.current) fileRef.current.value = ''
  }

  const selecionados = itens.filter(i => i.selecionado)
  const jaExistem = itens.filter(i => i.jaExiste)
  const totalSelecionado = selecionados.reduce((a, i) => a + i.amount, 0)

  return (
    <div>
      <div className="page-header">
        <h2>Importar Fatura</h2>
        <p>Importe o CSV do Nubank — duplicatas são detectadas automaticamente</p>
      </div>

      {/* ETAPA 1 — Upload */}
      {etapa === 'upload' && (
        <div style={{ maxWidth: 560 }}>
          <div className="table-wrap mb-24">
            <div className="table-header"><h3>⚙️ Configurações</h3></div>
            <div style={{ padding: 20 }}>
              <div className="form-group">
                <label>Cartão</label>
                <select value={cartaoId} onChange={e => setCartaoId(e.target.value)}>
                  {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Responsável pelas compras</label>
                <select value={pessoa} onChange={e => setPessoa(e.target.value)}>
                  <option>Pessoa 1</option>
                  <option>Esposa</option>
                  <option>Casal</option>
                </select>
              </div>
            </div>
          </div>

          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius)',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--surface)',
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              handleArquivo(e.dataTransfer.files[0])
            }}
          >
            <Upload size={40} style={{ color: 'var(--accent)', margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Arraste o arquivo CSV aqui</div>
            <div className="text-muted text-sm mb-16">ou clique para selecionar</div>
            <div style={{
              background: 'var(--surface2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 16px',
              display: 'inline-block',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}>
              Nubank: app → Cartão → Fatura → Exportar → CSV
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => handleArquivo(e.target.files[0])} />
          </div>
        </div>
      )}

      {/* Verificando duplicatas */}
      {verificando && (
        <div className="loading"><div className="spinner" /> Verificando duplicatas...</div>
      )}

      {/* ETAPA 2 — Revisar */}
      {etapa === 'revisar' && !verificando && (
        <div>
          <div className="cards-grid mb-24">
            <div className="card purple">
              <div className="card-label">Total no arquivo</div>
              <div className="card-value">{itens.length}</div>
            </div>
            <div className="card green">
              <div className="card-label">Novos para importar</div>
              <div className="card-value">{selecionados.length}</div>
            </div>
            <div className="card yellow">
              <div className="card-label">Já existem (ignorados)</div>
              <div className="card-value">{jaExistem.length}</div>
              <div className="card-sub">detectados automaticamente</div>
            </div>
            <div className="card red">
              <div className="card-label">Total a importar</div>
              <div className="card-value">{fmt(totalSelecionado)}</div>
            </div>
          </div>

          {jaExistem.length > 0 && (
            <div style={{
              background: 'var(--yellow-bg)',
              border: '1px solid var(--yellow)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              fontSize: '0.82rem',
              color: 'var(--yellow)',
              marginBottom: 20,
            }}>
              ⚠️ <strong>{jaExistem.length} transações</strong> já existem no app e foram desmarcadas automaticamente para evitar duplicatas. Você pode ver elas na lista abaixo (em cinza).
            </div>
          )}

          <div className="table-wrap mb-24">
            <div className="table-header">
              <h3>Revise antes de importar</h3>
              <div className="flex-center">
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setItens(p => p.map(i => ({ ...i, selecionado: !i.jaExiste })))}>
                  Selecionar novos
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setItens(p => p.map(i => ({ ...i, selecionado: false })))}>
                  Desmarcar todos
                </button>
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
                  const cartao = cartoes.find(c => c.id === cartaoId)
                  const comp = cartao
                    ? calcularMesCompetencia(item.date, cartao.dia_fechamento)
                    : { mes, ano }
                  return (
                    <tr key={i} style={{ opacity: item.selecionado ? 1 : 0.4 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.selecionado}
                          onChange={() => toggleItem(i)}
                          style={{ width: 'auto', cursor: 'pointer' }}
                        />
                      </td>
                      <td className="text-muted text-sm">{item.date}</td>
                      <td style={{ maxWidth: 180, fontSize: '0.82rem' }}>{item.title}</td>
                      <td>
                        <select
                          value={item.categoria}
                          onChange={e => alterarCategoria(i, e.target.value)}
                          style={{ padding: '4px 6px', fontSize: '0.78rem' }}
                          disabled={item.jaExiste}
                        >
                          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          value={item.tipo}
                          onChange={e => alterarTipo(i, e.target.value)}
                          style={{ padding: '4px 6px', fontSize: '0.78rem' }}
                          disabled={item.jaExiste}
                        >
                          <option>Despesa Fixa</option>
                          <option>Despesa Variável</option>
                        </select>
                      </td>
                      <td className="text-right text-red">{fmt(item.amount)}</td>
                      <td className="text-sm" style={{ color: 'var(--accent)' }}>
                        {MESES_NOME[comp.mes - 1].slice(0, 3)} {comp.ano}
                      </td>
                      <td>
                        {item.jaExiste
                          ? <span className="badge yellow">já existe</span>
                          : <span className="badge green">novo</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex-center" style={{ justifyContent: 'flex-end', gap: 12 }}>
            <button className="btn btn-ghost" onClick={reiniciar}>Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={importar}
              disabled={importando || selecionados.length === 0}
            >
              {importando
                ? 'Importando...'
                : `Importar ${selecionados.length} lançamentos (${fmt(totalSelecionado)})`}
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 3 — Concluído */}
      {etapa === 'concluido' && (
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
          {resultado?.erro ? (
            <>
              <AlertCircle size={56} style={{ color: 'var(--red)', margin: '0 auto 20px' }} />
              <h3 style={{ marginBottom: 8 }}>Erro na importação</h3>
              <p className="text-muted text-sm mb-24">{resultado.erro}</p>
            </>
          ) : (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--green-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <Check size={36} style={{ color: 'var(--green)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 8 }}>
                Importação concluída!
              </h3>
              <p className="text-muted mb-8">
                <strong style={{ color: 'var(--green)' }}>{resultado.total} lançamentos</strong> importados com sucesso.
              </p>
              {resultado.pulados > 0 && (
                <p className="text-muted text-sm mb-24">
                  {resultado.pulados} transações já existiam e foram ignoradas.
                </p>
              )}
            </>
          )}
          <div className="flex-center" style={{ justifyContent: 'center', gap: 12, marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={reiniciar}>Importar outro arquivo</button>
            <a href="/" className="btn btn-primary">Ver Dashboard</a>
          </div>
        </div>
      )}
    </div>
  )
}
