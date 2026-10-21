'use client'
import { useState } from 'react'
export default function Login() {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  return <section className="max-w-md mx-auto bg-white border p-6">
    <h1 className="font-barlow text-xl font-bold">Team sign-in</h1>
    <p className="text-sm text-fe-blue-gray mt-2">Use your approved Operations Center account. Your session expires automatically; sign in again when prompted.</p>
    <form className="space-y-4 mt-5" onSubmit={async e=>{
      e.preventDefault();setBusy(true);setError('')
      try { const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
        const data=await r.json();if(!r.ok)throw new Error(data.error);window.location.assign('/')
      } catch(e){setError(e instanceof Error?e.message:'Unable to sign in.')} finally{setBusy(false);setPassword('')}
    }}>
      <label className="block text-sm">Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} className="block w-full border p-3 mt-1" /></label>
      <label className="block text-sm">Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} className="block w-full border p-3 mt-1" /></label>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full bg-fe-blue text-white p-3 text-sm font-bold">{busy?'Signing in…':'Sign in'}</button>
    </form>
  </section>
}
