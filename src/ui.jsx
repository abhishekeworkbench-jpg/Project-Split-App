import { colorFor, fmt } from './lib'

export const tone = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : 'mut')
export const posText = (n) => (n > 0 ? `you’re owed ${fmt(n)}` : n < 0 ? `you owe ${fmt(-n)}` : 'settled up')

export function applyTheme(t) {
  const r = document.documentElement
  if (t === 'light' || t === 'dark') r.dataset.theme = t
  else r.removeAttribute('data-theme')
}

export function Avatar({ id, name, size = 36 }) {
  const ch = (name || '?').trim()[0] || '?'
  return (
    <div className="av" style={{ background: colorFor(id), width: size, height: size, fontSize: size / 2.4 }}>
      {ch.toUpperCase()}
    </div>
  )
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="row">
          <h1 className="sp t22">{title}</h1>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toast({ msg }) {
  return <div className={`toast ${msg ? 'on' : ''}`} role="status">{msg}</div>
}
