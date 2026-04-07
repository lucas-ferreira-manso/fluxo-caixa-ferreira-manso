export const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export const fmtPct = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format(v || 0)

export const CATEGORIAS = [
  '🏠 Moradia', '🍽️ Alimentação', '🚗 Transporte', '🏥 Saúde',
  '📚 Educação', '🎭 Lazer', '👗 Vestuário', '🛒 Supermercado',
  '📱 Assinaturas/Tech', '🐾 Pet', '💆 Bem-estar', '🔧 Outros',
]

export const FORMAS_PAG = ['Débito', 'Cartão de Crédito', 'Pix', 'Dinheiro', 'Transferência', 'Boleto']

export const TIPOS = ['Despesa Fixa', 'Despesa Variável', 'Investimento']

export const MESES_NOME = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]

export const corStatus = (realizado, orcamento) => {
  if (realizado === 0) return 'gray'
  if (orcamento === 0) return 'yellow'
  const pct = realizado / orcamento
  if (pct <= 0.8) return 'green'
  if (pct <= 1) return 'yellow'
  return 'red'
}
