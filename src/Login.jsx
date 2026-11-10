import { useState } from 'react'
import { supabase } from './supabase'
import { errMsg } from './lib'

export default function Login() {
  const [mode, setMode] = useState('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const r =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
        : await supabase.auth.signUp({ email: email.trim(), password: pw, options: { data: { full_name: name.trim() } } })
    setBusy(false)
    if (r.error) setMsg(errMsg(r.error))
    else if (mode === 'up' && !r.data.session) setMsg('Account created. Check your inbox to confirm your email, then sign in.')
  }

  async function google() {
    setMsg('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setMsg(errMsg(error))
  }

  return (
    <div className="app" style={{ paddingTop: '10vh' }}>
      <div className="big" style={{ fontSize: 40 }}>Splitly</div>
      <p className="mut">Split expenses with family, settle up in ₹.</p>
      <form onSubmit={submit}>
        {mode === 'up' && (
          <>
            <label className="l">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" autoCapitalize="words" />
          </>
        )}
        <label className="l">Email</label>
        <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <label className="l">Password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        {msg && <div className="note" style={{ marginTop: 12 }}>{msg}</div>}
        <button className="btn w" style={{ marginTop: 16 }} disabled={busy}>{mode === 'in' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button className="btn o w" style={{ marginTop: 10 }} onClick={google}>Continue with Google</button>
      <p className="mut sm" style={{ textAlign: 'center', marginTop: 14 }}>
        {mode === 'in' ? 'New here? ' : 'Already have an account? '}
        <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
          {mode === 'in' ? 'Create account' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
