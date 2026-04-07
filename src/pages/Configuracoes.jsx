import { useState } from 'react'
import { useFinanceiro } from '../hooks/useFinanceiro'
import { fmt, CATEGORIAS } from '../lib/utils'
import { Save, RefreshCw } from 'lucide-react'

export default function Configuracoes({ mes, ano }) {
  const { loading, config, orcamentos, salvarConfig, salvarOrcamento, recarregar } = useFinanceiro(mes, ano)
  const [nomes, setNomes] = useState(null)
  const [cotacao, setCotacao] = useState(null)
  const [orcEdit, setOrcEdit] = useState({})
  const [saved, setSaved] = useState(false)

  if (loading) return <div className="loading"><div className="spinner" /> Carregando...</div>

  const nome1 = nomes?.nome1 ?? config.nome_pessoa1 ?? 'Pessoa 1'
  const nome2 = nomes?.nome2 ?? config.nome_pessoa2 ?? 'Esposa'
  const cotacaoVal = cotacao ?? config.cotacao_usd ?? '5.14'

  const salvarTudo = async () => {
    const promises = []
    if (nomes) {
      promises.push(salvarConfig('nome_pessoa1', nome1))
      promises.push(salvarConfig('nome_pessoa2', nome2))
    }
    if (cotacao !== null) promises.push(salvarConfig('cotacao_usd', cotacaoVal))
    Object.entries(orcEdit).forEach(([cat, val]) => {
      promises.push(salvarOrcamento(cat, parseFloat(val) || 0))
    })
    await Promise.all(promises)
    setSaved(true)
    setNomes(null)
    setCotacao(null)
    setOrcEdit({})
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h2>Configurações</h2>
          <p>Personalize o app para o seu casal</p>
        </div>
        <button className="btn btn-primary" onClick={salvarTudo}>
          <Save size={15} /> {saved ? '✓ Salvo!' : 'Salvar alterações'}
        </button>
      </div>

      <div className="grid-2 mb-24">
        {/* Nomes */}
        <div className="table-wrap">
          <div className="table-header"><h3>👫 Nomes do Casal</h3></div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label>Nome da Pessoa 1 (quem recebe em USD)</label>
              <input
                value={nome1}
                onChange={e => setNomes(n => ({ ...(n || { nome1: nome1, nome2: nome2 }), nome1: e.target.value }))}
                placeholder="Ex: João, Marido..."
              />
            </div>
            <div className="form-group">
              <label>Nome da Pessoa 2</label>
              <input
                value={nome2}
                onChange={e => setNomes(n => ({ ...(n || { nome1: nome1, nome2: nome2 }), nome2: e.target.value }))}
                placeholder="Ex: Maria, Esposa..."
              />
            </div>
          </div>
        </div>

        {/* Cotação */}
        <div className="table-wrap">
          <div className="table-header"><h3>💵 Cotação do Dólar</h3></div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label>Cotação atual USD → BRL</label>
              <input
                type="number"
                step="0.01"
                value={cotacaoVal}
                onChange={e => setCotacao(e.target.value)}
              />
              <div className="text-muted text-sm mt-4">
                💡 Use a cotação do dia do recebimento ou a média do mês
              </div>
            </div>
            <div className="card yellow" style={{ padding: 14, marginTop: 8 }}>
              <div className="card-label">Exemplo de conversão</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--yellow)' }}>
                $1.000 → {fmt(1000 * parseFloat(cotacaoVal || 5.14))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orçamentos por categoria */}
      <div className="table-wrap">
        <div className="table-header">
          <h3>📊 Orçamentos por Categoria</h3>
          <span className="text-sm text-muted">Defina quanto planeja gastar em cada categoria</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {CATEGORIAS.map(cat => {
              const orcAtual = orcamentos.find(o => o.categoria === cat)?.valor || 0
              const editVal = orcEdit[cat] ?? orcAtual
              return (
                <div key={cat} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{cat}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editVal === 0 ? '' : editVal}
                    placeholder="0,00"
                    onChange={e => setOrcEdit(prev => ({ ...prev, [cat]: e.target.value }))}
                    style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Dicas */}
      <div className="table-wrap mt-24">
        <div className="table-header"><h3>💡 Dicas de Uso</h3></div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['📅 Lançamentos', 'Registre cada despesa na aba Lançamentos. Use o filtro de mês na barra lateral para navegar entre períodos.'],
            ['💵 Cotação', 'Atualize a cotação do dólar toda vez que receber o salário para ter os cálculos precisos.'],
            ['📊 Orçamentos', 'Defina orçamentos por categoria para o Dashboard mostrar alertas de estouro (🔴 Excedido).'],
            ['🎯 Metas', 'Atualize o campo "Já Guardado" nas metas mensalmente para acompanhar seu progresso.'],
            ['📈 Histórico', 'O histórico anual é gerado automaticamente a partir dos lançamentos de cada mês.'],
            ['🔄 Compartilhamento', 'O app está na nuvem — qualquer pessoa com o link pode acessar e editar em tempo real.'],
          ].map(([titulo, texto]) => (
            <div key={titulo} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>{titulo}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{texto}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Botão salvar flutuante */}
      {(nomes || cotacao !== null || Object.keys(orcEdit).length > 0) && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--accent)', color: '#0f0f13',
          padding: '12px 24px', borderRadius: 100,
          fontWeight: 600, fontSize: '0.9rem',
          boxShadow: '0 8px 32px rgba(167,139,250,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          border: 'none', fontFamily: 'var(--font-body)',
        }}
          onClick={salvarTudo}
        >
          <Save size={16} /> Salvar alterações
        </div>
      )}
    </div>
  )
}
