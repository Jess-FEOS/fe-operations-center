const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function compile(file,box){vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,box);return box.exports}
const policy=compile(__dirname+'/../src/lib/access-policy.ts',{exports:{},URL})
function app(env={},identity='team@example.test'){
  return compile(__dirname+'/../src/middleware.ts',{exports:{},URL,process:{env},fetch:async()=>{
    if(identity instanceof Error)throw identity
    return {ok:true,json:async()=>({email:identity})}
  },require(name){
    if(name==='@/lib/access-policy')return policy
    if(name==='next/server')return {NextResponse:{
      next:()=>({status:200,next:true}),
      json:(data,opts)=>({status:opts?.status||200,data}),
      redirect:url=>({status:307,url:String(url)}),
    }}
    throw Error(name)
  }}).middleware
}
function req(path='/api/projects',method='GET',headers={},token){
  return {method,url:'http://localhost:3000'+path,nextUrl:{pathname:path},headers:new Headers({host:'app.example.test',...headers}),cookies:{get:()=>token?{value:token}:undefined}}
}
test('preview forces writes off while preserving read-only checklist review',async()=>{
  const handle=app({VERCEL_ENV:'preview',OPS_WRITES_ENABLED:'true'})
  assert.equal((await handle(req('/api/projects','POST'))).status,403)
  assert.equal((await handle(req('/api/projects/prepare','POST'))).next,true)
  assert.equal((await handle(req('/api/projects'))).next,true)
})
test('preview permits only exact prepare endpoint, not hypothetical update writes',async()=>{
  const handle=app({VERCEL_ENV:'preview'})
  assert.equal((await handle(req('/api/updates/prepare','POST'))).next,true)
  for(const path of ['/api/updates/apply','/api/updates/prepare/extra','/api/updates']){
    assert.equal((await handle(req(path,'POST'))).status,403)
  }
  assert.equal((await handle(req('/api/updates/prepare','PUT'))).status,403)
  assert.equal((await handle(req('/api/updates/prepare','POST',{origin:'https://attacker.example.test'}))).status,403)
})
test('production retains approved no-login reads and writes',async()=>{
  const handle=app({NODE_ENV:'production',VERCEL_ENV:'production'})
  assert.equal((await handle(req())).next,true)
  assert.equal((await handle(req('/api/projects','POST',{origin:'https://app.example.test'}))).next,true)
})
test('production write kill switch preserves read-only reviews',async()=>{
  const handle=app({VERCEL_ENV:'production',OPS_WRITES_ENABLED:'false'})
  assert.equal((await handle(req('/api/projects','POST'))).status,403)
  assert.equal((await handle(req('/api/projects/prepare','POST'))).next,true)
  assert.equal((await handle(req())).next,true)
})
test('production pages do not redirect to login',async()=>{
  const result=await app({VERCEL_ENV:'production'})(req('/projects','GET',{'x-forwarded-proto':'https'}))
  assert.equal(result.next,true)
})
test('foreign or opaque origins cannot submit to preview or production routes',async()=>{
  const handle=app({VERCEL_ENV:'preview'})
  for(const origin of ['https://attacker.example.test','null']){
    assert.equal((await handle(req('/api/projects/prepare','POST',{origin}))).status,403)
    assert.equal((await app({VERCEL_ENV:'production'})(req('/api/projects','POST',{origin}))).status,403)
  }
  assert.equal((await handle(req('/api/projects/prepare','POST',{origin:'https://app.example.test'}))).next,true)
})
