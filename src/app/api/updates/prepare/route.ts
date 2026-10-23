import { NextRequest,NextResponse } from 'next/server'
import { MAX_INPUT,parseUpdateBatch,reusableUpdatePrompt,validInputDate } from '@/lib/update-intake'

export const dynamic='force-dynamic'
export const maxDuration=60
export async function POST(request:NextRequest) {
  // Preview-only AI extraction. Do not expose a new paid, unauthenticated AI
  // service in production before separate access/bulk-approval work is reviewed.
  if(process.env.VERCEL_ENV!=='preview' && process.env.OPS_LOCAL_REVIEW!=='true')
    return NextResponse.json({error:'AI intake is preview-only. Use the reusable prompt in your AI app and paste its JSON output for review.'},{status:503})
  try {
    if(Number(request.headers.get('content-length') || 0)>400000)
      return NextResponse.json({error:'Input is too large.'},{status:413})
    const raw=await request.text()
    if(raw.length>MAX_INPUT*6+2000)return NextResponse.json({error:'Input is too large.'},{status:413})
    const body=JSON.parse(raw)
    if(body.consent!==true)return NextResponse.json({error:'Confirm that this text may be sent to the configured AI provider.'},{status:400})
    if(typeof body.text!=='string' || !body.text.trim() || body.text.length>MAX_INPUT)
      return NextResponse.json({error:'Provide 1–80,000 characters of meeting notes or an AI summary.'},{status:400})
    if(body.source_date && (typeof body.source_date!=='string' || !validInputDate(body.source_date)))
      return NextResponse.json({error:'Use a valid meeting/source date.'},{status:400})
    const key=process.env.PERPLEXITY_API_KEY
    if(!key)return NextResponse.json({error:'AI extraction is not configured on this server. Copy the reusable prompt and your transcript into your own AI app, then paste the returned JSON under AI update batch.'},{status:503})
    const response=await fetch('https://api.perplexity.ai/v1/agent',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(45000),
      body:JSON.stringify({
        model:process.env.OPS_IMPORT_MODEL || 'openai/gpt-5.6-terra',
        tools:[],tool_choice:'none',stream:false,
        input:[
          {role:'system',content:reusableUpdatePrompt(body.source_date || '')+'\nFor this request, use ONLY the supplied text. No tools, browsing, external actions or database access. Return only the JSON object.'},
          {role:'user',content:JSON.stringify({source_date:body.source_date || null,untrusted_source_text:body.text})},
        ],
      }),
    })
    if(!response.ok)return NextResponse.json({error:`AI extraction failed (${response.status}). Nothing was saved. Retry or use the reusable prompt in your own AI app.`},{status:502})
    const data=await response.json()
    if(data.status!=='completed')return NextResponse.json({error:'The AI response was incomplete. Split the input into smaller sections and retry. Nothing was saved.'},{status:502})
    const output=(data.output || []).filter((item:any)=>item.type==='message' && item.role==='assistant')
      .flatMap((item:any)=>item.content || []).filter((part:any)=>part.type==='output_text').map((part:any)=>part.text).join('\n')
    try {return NextResponse.json({batch:parseUpdateBatch(output,body.text),applied:false},{headers:{'Cache-Control':'no-store'}})}
    catch {return NextResponse.json({error:'The AI returned an invalid update batch. Nothing was saved. Retry with a smaller section or use the reusable prompt.'},{status:502})}
  } catch {
    return NextResponse.json({error:'Could not prepare updates. Check the input and retry; nothing was saved.'},{status:400})
  }
}
