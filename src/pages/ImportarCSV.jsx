import { useState, useRef } from 'react'
import { useFinanceiro, calcularMesCompetencia } from '../hooks/useFinanceiro'
import { fmt, CATEGORIAS, MESES_NOME } from '../lib/utils'
import { Upload, Check, X, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Mapeamento automático de palavras-chave para categorias
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
  '💆 Bem-estar': ['academia', 'pilates', 'yoga', 'spa', 'salao', 'barbearia', 'estetica'],
  '🐾 Pet': ['pet', 'veterinario', 'animal', 'racao'],
}

function detectarCategoria(titulo) {
  const lower = titulo.toLowerCase()
  for (const [categoria, keywords] of Object.entries(MAPA_CATEGORIAS)) {
    if (keywords.some(kw => lower.includes(kw))) return categoria
  }
  return '🔧 Outros'
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
    itens.push({ date, title, amount })
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
  const [etapa, setEtapa] = useState('upload') // upload | revisar | concluido
  const fileRef = useRef()

  const nubank = cartoes.find(c => c.nome.toLowerCase().includes('nubank'))

  const handleArquivo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const texto = ev.target.result
      const parsed = parsearCSVNubank(texto)
      const comCategoria = parsed.map(item => ({
        ...item,
        categoria: detectarCategoria(item.title),
        tipo: 'Despesa Variável',
        selecionado: true,
      }))
      setItens(comCategoria)
      setCartaoId(nubank?.id || cartoes[0]?.id || '')
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
        mes: comp.mes,
        ano: comp.ano,
      }
    })

    const { error } = await supabase.from('lancamentos').insert(lancamentos)
    await recarregar()
    setImportando(false)
    setResultado({ total: lancamentos.length, erro: error?.message })
    setEtapa('concluido')
  }

  const reiniciar = () => {
    setItens([])
    setResultado(null)
    setEtapa('upload')
    if (fileRef.current) fileRef.current.value = ''
  }

  const selecionados = itens.filter(i => i.selecionado)
  const totalSelecionado = selecionados.reduce((a, i) => a + i.amount, 0)

  return (
    <div>
      <div className="page-header">
        <h2>Importar Fatura</h2>
        <p>Importe o CSV do Nubank para preencher os lançamentos automaticamente</p>
      </div>

      {/* ETAPA 1 — Upload */}
      {etapa === 'upload' && (
        <div style={{ maxWidth: 560 }}>
          <div className="table-wrap mb-24">
            <div className="table-header"><h3>⚙️ Configurações da importação</h3></div>
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
              transition: 'border-color 0.15s',
              background: 'var(--surface)',
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = ev => {
                  const parsed = parsearCSVNubank(ev.target.result)
                  const comCategoria = parsed.map(item => ({
                    ...item,
                    categoria: detectarCategoria(item.title),
                    tipo: 'Despesa Variável',
                    selecionado: true,
                  }))
                  setItens(comCategoria)
                  setCartaoId(nubank?.id || cartoes[0]?.id || '')
                  setEtapa('revisar')
                }
                reader.readAsText(file)
              }
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
              No Nubank: app → Cartão de Crédito → Fatura → Exportar → CSV
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleArquivo} />
          </div>
        </div>
      )}

      {/* ETAPA 2 — Revisar */}
      {etapa === 'revisar' && (
        <div>
          {/* Resumo */}
          <div className="cards-grid mb-24">
            <div className="card purple">
              <div className="card-label">Total de transações</div>
              <div className="card-value">{itens.length}</div>
            </div>
            <div className="card green">
              <div className="card-label">Selecionadas</div>
              <div className="card-value">{selecionados.length}</div>
            </div>
            <div className="card red">
              <div className="card-label">Total selecionado</div>
              <div className="card-value">{fmt(totalSelecionado)}</div>
            </div>
          </div>

          <div className="table-wrap mb-24">
            <div className="table-header">
              <h3>Revise as transações antes de importar</h3>
              <div className="flex-center">
                <button className="btn btn-ghost btn-sm" onClick={() => setItens(p => p.map(i => ({ ...i, selecionado: true })))}>
                  Selecionar todos
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setItens(p => p.map(i => ({ ...i, selecionado: false })))}>
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
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => {
                  const cartao = cartoes.find(c => c.id === cartaoId)
                  const comp = cartao ? calcularMesCompetencia(item.date, cartao.dia_fechamento) : { mes, ano }
                  return (
                    <tr key={i} style={{ opacity: item.selecionado ? 1 : 0.35 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.selecionado}
                          onChange={() => toggleItem(i)}
                          style={{ width: 'auto', cursor: 'pointer' }}
                        />
                      </td>
                      <td className="text-muted text-sm">{item.date}</td>
                      <td style={{ maxWidth: 200, fontSize: '0.82rem' }}>{item.title}</td>
                      <td>
                        <select
                          value={item.categoria}
                          onChange={e => alterarCategoria(i, e.target.value)}
                          style={{ padding: '4px 6px', fontSize: '0.78rem' }}
                        >
                          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          value={item.tipo}
                          onChange={e => alterarTipo(i, e.target.value)}
                          style={{ padding: '4px 6px', fontSize: '0.78rem' }}
                        >
                          <option>Despesa Fixa</option>
                          <option>Despesa Variável</option>
                        </select>
                      </td>
                      <td className="text-right text-red">{fmt(item.amount)}</td>
                      <td className="text-sm" style={{ color: 'var(--accent)' }}>
                        {MESES_NOME[comp.mes - 1].slice(0, 3)} {comp.ano}
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
              {importando ? 'Importando...' : `Importar ${selecionados.length} lançamentos (${fmt(totalSelecionado)})`}
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
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Check size={36} style={{ color: 'var(--green)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 8 }}>
                Importação concluída!
              </h3>
              <p className="text-muted mb-24">
                {resultado.total} lançamentos importados com sucesso.<br />
                Eles já aparecem nos meses corretos baseados no fechamento do cartão.
              </p>
            </>
          )}
          <div className="flex-center" style={{ justifyContent: 'center', gap: 12 }}>
            <button className="btn btn-ghost" onClick={reiniciar}>Importar outro arquivo</button>
            <a href="/" className="btn btn-primary">Ver Dashboard</a>
          </div>
        </div>
      )}
    </div>
  )
}
