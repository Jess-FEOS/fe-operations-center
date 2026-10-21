import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { allowedEmail } from '@/lib/access-policy'
export async function POST(request: NextRequest) {
  if(!process.env.OPS_ALLOWED_EMAILS) return NextResponse.json({error:'Team sign-in has not been configured. This preview is not ready for production release.'},{status:503})
  try {
    const body=await request.json()
    if(typeof body.email!=='string' || typeof body.password!=='string' || !allowedEmail(body.email,process.env.OPS_ALLOWED_EMAILS)) {
      return NextResponse.json({error:'Unable to sign in with these credentials.'},{status:401})
    }
    const auth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await auth.auth.signInWithPassword({email:body.email.trim(),password:body.password})
    if(error || !data.session || !allowedEmail(data.user?.email,process.env.OPS_ALLOWED_EMAILS)) {
      return NextResponse.json({error:'Unable to sign in with these credentials.'},{status:401})
    }
    const response=NextResponse.json({ok:true})
    response.cookies.set('fe-session',data.session.access_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:data.session.expires_in})
    return response
  } catch { return NextResponse.json({error:'Unable to sign in.'},{status:400}) }
}
