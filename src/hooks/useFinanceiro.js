import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const MES_ATUAL = new Date().getMonth() + 1
const ANO_ATUAL = new Date().getFullYear()

export function calcularMesCompetencia(dataStr, diaFechamento) {
  const hoje = new Date()
  const data = dataStr ? new Date(dataStr + 'T12:00:00') : hoje
  const dia = data.getDate()
  const mes = data.getMonth() + 1
  const ano = data.getFullYear()

  if (dia > diaFechamento) {
    if (mes === 12) return { mes: 1, ano: ano + 1 }
    return { mes: mes + 1, ano }
  }
  return { mes, ano }
}

export function useFinanceiro(mes = MES_ATUAL, ano = ANO_ATUAL) {
  const [lancamentos, setLancamentos] = useState([])
  const [receitas, setReceitas] = useState([])
  const [metas, setMetas] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [config, setConfig] = useState({ cotacao_usd: 5.14, nome_pessoa1: 'Pessoa 1', nome_pessoa2: 'Esposa' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [l, r, m, o, c, ct] = await Promise.all([
        supabase.from('lancamentos').select('*').eq('mes', mes).eq('ano', ano).order('created_at', { ascending: false }),
        supabase.from('receitas').select('*').eq('mes', mes).eq('ano', ano),
        supabase.from('metas').select('*').eq('ativa', true),
        supabase.from('orcamentos').select('*'),
        supabase.from('configuracoes').select('*'),
        supabase.from('cartoes').select('*').eq('ativo', true).order('nome'),
      ])
      if (l.error) throw l.error
      if (r.error) throw r.error
      if (m.error) throw m.error
      if (o.error) throw o.error
      if (c.error) throw c.error
      if (ct.error) throw ct.error

      setLancamentos(l.data || [])
      setReceitas(r.data || [])
      setMetas(m.data || [])
      setOrcamentos(o.data || [])
      setCartoes(ct.data || [])
      const cfg = {}
      ;(c.data || []).forEach(row => { cfg[row.chave] = row.valor })
      setConfig(cfg)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [mes, ano])

  useEffect(() => { carregar() }, [carregar])

  const cotacao = parseFloat(config.cotacao_usd || 5.14)

  const receitaTotal = receitas.reduce((acc, r) => {
    const val = r.moeda === 'USD' ? r.valor * cotacao : r.valor
    return acc + val
  }, 0)

  const despesasFixas = lancamentos.filter(l => l.tipo === 'Despesa Fixa').reduce((a, l) => a + l.valor, 0)
  const despesasVariaveis = lancamentos.filter(l => l.tipo === 'Despesa Variável').reduce((a, l) => a + l.valor, 0)
  const investimentos = lancamentos.filter(l => l.tipo === 'Investimento').reduce((a, l) => a + l.valor, 0)
  const totalDespesas = despesasFixas + despesasVariaveis + investimentos
  const totalCartao = lancamentos.filter(l => l.cartao_id).reduce((a, l) => a + l.valor, 0)
  const saldoMes = receitaTotal - totalDespesas

  const gastosPorCategoria = lancamentos
    .filter(l => l.tipo !== 'Receita')
    .reduce((acc, l) => {
      acc[l.categoria] = (acc[l.categoria] || 0) + l.valor
      return acc
    }, {})

  const cartaoPorCategoria = lancamentos
    .filter(l => l.cartao_id)
    .reduce((acc, l) => {
      acc[l.categoria] = (acc[l.categoria] || 0) + l.valor
      return acc
    }, {})

  const adicionarLancamento = async (dados) => {
    let mesComp = mes
    let anoComp = ano

    if (dados.cartao_id) {
      const cartao = cartoes.find(c => c.id === dados.cartao_id)
      if (cartao && dados.data) {
        const comp = calcularMesCompetencia(dados.data, cartao.dia_fechamento)
        mesComp = comp.mes
        anoComp = comp.ano
      } else if (cartao) {
        // Sem data: usa hoje para calcular
        const hoje = new Date()
        const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`
        const comp = calcularMesCompetencia(dataHoje, cartao.dia_fechamento)
        mesComp = comp.mes
        anoComp = comp.ano
      }
    }

    const { error } = await supabase.from('lancamentos').insert([{
      ...dados,
      mes: mesComp,
      ano: anoComp,
      forma_pagamento: dados.cartao_id ? 'Cartão de Crédito' : dados.forma_pagamento,
    }])
    if (!error) await carregar()
    return { error }
  }

  const editarLancamento = async (id, dados) => {
    let mesComp = dados.mes
    let anoComp = dados.ano

    if (dados.cartao_id) {
      const cartao = cartoes.find(c => c.id === dados.cartao_id)
      if (cartao) {
        const dataRef = dados.data || new Date().toISOString().slice(0,10)
        const comp = calcularMesCompetencia(dataRef, cartao.dia_fechamento)
        mesComp = comp.mes
        anoComp = comp.ano
      }
    }

    const { error } = await supabase.from('lancamentos').update({
      ...dados,
      mes: mesComp,
      ano: anoComp,
      forma_pagamento: dados.cartao_id ? 'Cartão de Crédito' : dados.forma_pagamento,
    }).eq('id', id)
    if (!error) await carregar()
    return { error }
  }

  const excluirLancamento = async (id) => {
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (!error) await carregar()
    return { error }
  }

  const salvarReceita = async (dados) => {
    if (dados.id) {
      const { error } = await supabase.from('receitas').update(dados).eq('id', dados.id)
      if (!error) await carregar()
      return { error }
    }
    const { error } = await supabase.from('receitas').insert([{ ...dados, mes, ano }])
    if (!error) await carregar()
    return { error }
  }

  const excluirReceita = async (id) => {
    const { error } = await supabase.from('receitas').delete().eq('id', id)
    if (!error) await carregar()
    return { error }
  }

  const salvarConfig = async (chave, valor) => {
    await supabase.from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' })
    await carregar()
  }

  const salvarOrcamento = async (categoria, valor) => {
    await supabase.from('orcamentos').upsert({ categoria, valor }, { onConflict: 'categoria' })
    await carregar()
  }

  const salvarMeta = async (dados) => {
    if (dados.id) {
      const { error } = await supabase.from('metas').update(dados).eq('id', dados.id)
      if (!error) await carregar()
      return { error }
    }
    const { error } = await supabase.from('metas').insert([dados])
    if (!error) await carregar()
    return { error }
  }

  const salvarCartao = async (dados) => {
    if (dados.id) {
      const { error } = await supabase.from('cartoes').update(dados).eq('id', dados.id)
      if (!error) await carregar()
      return { error }
    }
    const { error } = await supabase.from('cartoes').insert([{ ...dados, ativo: true }])
    if (!error) await carregar()
    return { error }
  }

  const excluirCartao = async (id) => {
    const { error } = await supabase.from('cartoes').update({ ativo: false }).eq('id', id)
    if (!error) await carregar()
    return { error }
  }

  return {
    lancamentos, receitas, metas, orcamentos, cartoes, config, loading, error,
    cotacao, receitaTotal, despesasFixas, despesasVariaveis, investimentos,
    totalDespesas, totalCartao, saldoMes, gastosPorCategoria, cartaoPorCategoria,
    adicionarLancamento, editarLancamento, excluirLancamento,
    salvarReceita, excluirReceita,
    salvarConfig, salvarOrcamento, salvarMeta,
    salvarCartao, excluirCartao,
    recarregar: carregar,
  }
}
