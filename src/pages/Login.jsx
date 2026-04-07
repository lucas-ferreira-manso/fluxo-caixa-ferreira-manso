import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, cadastrar } = useAuth()
  const [modo, setModo] = useState('login')
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
      if (senha.length < 6) {
        setErro('A senha deve ter pelo menos 6 caracteres.')
        setLoading(false)
        return
      }
      const { error } = await cadastrar(email, senha)
      if (error) {
        if (error.message.includes('already registered')) {
          setErro('Este email já está cadastrado. Faça login.')
        } else {
          setErro('Erro ao criar conta: ' + error.message)
        }
      } else {
        setSucesso('Conta criada com sucesso! Agora faça login.')
        setModo('login')
        setSenha('')
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

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>💰</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--text)', lineHeight: 1.1 }}>
            Financeiro<br />do Casal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 8 }}>
            controle financeiro em tempo real
          </p>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '32px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: 4,
            marginBottom: 28,
          }}>
            {[
              { id: 'login', label: 'Entrar' },
              { id: 'cadastro', label: 'Criar conta' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => { setModo(m.id); setErro(''); setSucesso('') }}
                style={{
                  padding: '9px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: modo === m.id ? 'var(--accent)' : 'transparent',
                  color: modo === m.id ? '#0f0f13' : 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {m.label}
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
              />
            </div>

            {erro && (
              <div style={{
                background: 'var(--red-bg)',
                border: '1px solid var(--red)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: 'var(--red)',
                marginBottom: 16,
              }}>
                ⚠️ {erro}
              </div>
            )}

            {sucesso && (
              <div style={{
                background: 'var(--green-bg)',
                border: '1px solid var(--green)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: 'var(--green)',
                marginBottom: 16,
              }}>
                ✅ {sucesso}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: 'var(--accent)',
                color: '#0f0f13',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar minha conta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Você e sua esposa criam contas separadas.<br />
          Os dados financeiros são compartilhados entre os dois.
        </p>
      </div>
    </div>
  )
}
