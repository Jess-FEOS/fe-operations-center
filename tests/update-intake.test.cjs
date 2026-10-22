const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function compile(file,extra={}){
  const box={exports:{},URL,Date,Set,console,...extra}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(__dirname+'/../'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,box)
  return box.exports
}
const intake=compile('src/lib/update-intake.ts')
const proposal={area:'marketing',action:'create',title:'Sample blog',project:'Sample program',owner:'Sample owner',date:'2026-11-04',
  date_type:'post',status:'idea',platforms:['Blog'],evidence:'Publish the blog on November 4.',source_ref:'Meeting, 02:10',questions:[]}
const batch=updates=>JSON.stringify({version:1,updates,questions:[]})
test('reusable prompt includes source access, transcripts, evidence, date/owner and privacy safeguards',()=>{
  const prompt=intake.reusableUpdatePrompt('2026-10-22')
  for(const phrase of ['Outlook','Notion','MEETING TRANSCRIPTS','2026-10-22','One accountable owner','verbatim evidence',
    'Do not imply','marketing launch and program start','Do not execute code','not authorization'])assert.ok(prompt.includes(phrase),phrase)
})
test('valid batches and fenced JSON parse; duplicates skipped without claiming live deduplication',()=>{
  assert.equal(intake.parseUpdateBatch('```json\n'+batch([proposal])+'\n```').updates.length,1)
  const result=intake.parseUpdateBatch(batch([proposal,proposal]))
  assert.equal(result.updates.length,1);assert.match(result.questions[0],/Repeated proposal/)
})
test('missing fields and source mismatch stay visible questions; updates require record matching',()=>{
  const result=intake.parseUpdateBatch(batch([{...proposal,action:'update',owner:null,project:null,date:null}]),'Different transcript')
  assert.equal(result.updates[0].questions.length,5)
  assert.ok(result.updates[0].questions.some(q=>q.includes('Evidence excerpt')))
  assert.ok(result.updates[0].questions.some(q=>q.includes('existing Ops Center record')))
})
test('reject malformed JSON, invalid types/dates/platforms/size, allow an honest empty batch',()=>{
  assert.throws(()=>intake.parseUpdateBatch('not JSON'),/valid update JSON/)
  for(const patch of [{date:'2026-02-30'},{date:'2026-13-01'},{area:'delete_database'},{platforms:['Unknown']},{evidence:''},{title:5},{date_type:'start-ish'}])
    assert.throws(()=>intake.parseUpdateBatch(batch([{...proposal,...patch}])))
  assert.throws(()=>intake.parseUpdateBatch(batch(Array(151).fill(proposal))))
  assert.throws(()=>intake.parseUpdateBatch('x'.repeat(80001)))
  assert.equal(intake.parseUpdateBatch(batch([])).updates.length,0)
  assert.equal(intake.validInputDate('2028-02-29'),true)
})
test('separate schedules are preserved, source text is data and no mutation code is imported',()=>{
  const result=intake.parseUpdateBatch(batch([proposal,{...proposal,date:'2026-11-05',title:'<script>delete everything</script>'}]))
  assert.equal(result.updates.length,2)
  const code=fs.readFileSync(__dirname+'/../src/app/api/updates/prepare/route.ts','utf8')
  assert.equal(code.includes('supabase'),false)
  assert.ok(code.includes("tools:[],tool_choice:'none'"))
})
function api({env={VERCEL_ENV:'preview',PERPLEXITY_API_KEY:'test-only'},status=200,output,statusText='completed',networkError=false}={}){
  const calls=[]
  const POST=compile('src/app/api/updates/prepare/route.ts',{process:{env},AbortSignal,fetch:async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body)})
    if(networkError)throw Error('provider down')
    return {ok:status===200,status,json:async()=>({status:statusText,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:output || batch([proposal])}]}]})}
  },require(name){
    if(name==='next/server')return {NextResponse:{json:(data,options)=>({data,status:options?.status||200,headers:options?.headers})}}
    if(name==='@/lib/update-intake')return intake
    throw Error(name)
  }}).POST
  return {calls,send:(body={text:proposal.evidence,source_date:'2026-10-22',consent:true})=>POST({headers:new Headers(),text:async()=>JSON.stringify(body)})}
}
test('AI extraction is no-tools, consented, non-writing and explicitly completed before parsing',async()=>{
  const app=api(),result=await app.send()
  assert.equal(result.status,200);assert.equal(result.data.applied,false)
  assert.equal(result.data.batch.updates.length,1)
  assert.equal(app.calls[0].body.tools.length,0);assert.equal(app.calls[0].body.tool_choice,'none')
  assert.equal(result.headers['Cache-Control'],'no-store')
})
test('production, missing key, consent and invalid date fail before AI calls',async()=>{
  for(const options of [{env:{VERCEL_ENV:'production',PERPLEXITY_API_KEY:'test-only'}},{env:{VERCEL_ENV:'preview'}}]){
    const app=api(options);assert.equal((await app.send()).status,503);assert.equal(app.calls.length,0)
  }
  for(const body of [{text:'notes',consent:false},{text:'notes',consent:true,source_date:'2026-13-01'},{text:'x'.repeat(80001),consent:true}]){
    const app=api();assert.equal((await app.send(body)).status,400);assert.equal(app.calls.length,0)
  }
})
test('provider errors, incomplete output and invalid JSON cannot look like successful reviews',async()=>{
  assert.equal((await api({status:429}).send()).status,502)
  assert.equal((await api({statusText:'incomplete'}).send()).status,502)
  assert.equal((await api({output:'not json'}).send()).status,502)
  assert.equal((await api({networkError:true}).send()).status,400)
})
test('plain transcript files are bounded, unsupported files and empty input rejected',async()=>{
  const reader=compile('src/lib/transcript-file.ts',{require:name=>name==='fflate'?require('fflate'):intake}).readTranscriptFile
  assert.equal(await reader(new File(['Meeting notes'], 'meeting.txt')),'Meeting notes')
  for(const file of [new File([''], 'empty.txt'),new File(['PDF'], 'notes.pdf'),new File(['x'.repeat(80001)],'long.txt'),new File(['\0abc'],'binary.txt')])
    await assert.rejects(reader(file))
})
