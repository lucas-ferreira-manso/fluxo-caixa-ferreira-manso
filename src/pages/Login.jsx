import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, cadastrar } = useAuth()
  const [modo, setModo] = useState('login') // 'login' ou 'cadastro'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setLoading(true)

    if (modo === 'login') {
      const { error } = await login(email, senha)
      if (error) setErro('Email ou senha incorretos. Tente novamente.')
    } else {
      const { error } = await cadastrar(email, senha)
      if (error) {
        if (error.message.includes('already registered')) {
          setErro('Este email já está cadastrado. Faça login.')
        } else if (error.message.includes('Password')) {
          setErro('A senha deve ter pelo menos 6 caracteres.')
        } else {
          setErro('Erro ao criar conta. Tente novamente.')
        }
      } else {
        setSucesso('Conta criada! Verifique seu email para confirmar o cadastro, depois faça login.')
        setModo('login')
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💰</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            color: 'var(--text)',
            lineHeight: 1.1,
          }}>
            Financeiro<br />do Casal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 8 }}>
            controle financeiro em tempo real
          </p>
        </div>

        {/* Card do formulário */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '32px',
        }}>
          {/* Tabs login/cadastro */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: 4,
            marginBottom: 28,
          }}>
            {['login', 'cadastro'].map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setErro(''); setSucesso('') }}
                style={{
                  padding: '8px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: modo === m ? 'var(--accent)' : 'transparent',
                  color: modo === m ? '#0f0f13' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label>Senha</label>
              <input
                type="password"
                placeholder={modo === 'cadastro' ? 'mínimo 6 caracteres' : '••••••••'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {erro && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid var(--red)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: 'var(--red)',
                marginBottom: 16,
              }}>
                {erro}
              </div>
            )}

            {sucesso && (
              <div style={{
                background: 'var(--green-bg)',
                border: '1px solid var(--green)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: 'var(--green)',
                marginBottom: 16,
              }}>
                {sucesso}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.95rem' }}
            >
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar minha conta'}
            </button>
          </form>
        </div>

        {modo === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Primeira vez?{' '}
            <span
              style={{ color: 'var(--accent)', cursor: 'pointer' }}
              onClick={() => setModo('cadastro')}
            >
              Crie sua conta
            </span>
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Você e sua esposa precisam criar contas separadas.<br />
          Os dados do casal são compartilhados entre os dois.
        </p>
      </div>
    </div>
  )
}
