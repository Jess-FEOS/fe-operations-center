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
test('unsigned production API requests fail closed, including bypass-header probes',async()=>{
  const handle=app({NODE_ENV:'production',OPS_WRITES_ENABLED:'true'})
  assert.equal((await handle(req())).status,401)
  assert.equal((await handle(req('/api/projects','GET',{'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware'}))).status,401)
})
test('production verifies the session against the exact approved-email list',async()=>{
  const env={NODE_ENV:'production',OPS_WRITES_ENABLED:'true',OPS_ALLOWED_EMAILS:'team@example.test'}
  assert.equal((await app(env)(req('/api/projects','GET',{},'test-session'))).next,true)
  assert.equal((await app(env,'outsider@example.test')(req('/api/projects','GET',{},'test-session'))).status,401)
  assert.equal((await app(env,new Error('identity unavailable'))(req('/api/projects','GET',{},'test-session'))).status,401)
})
test('sign-in redirects retain the incoming app host and HTTPS behind a proxy',async()=>{
  const result=await app({NODE_ENV:'production'})(req('/projects','GET',{'x-forwarded-proto':'https'}))
  assert.equal(result.url,'https://app.example.test/login')
})
test('foreign or opaque origins cannot submit to preview or sign-in routes',async()=>{
  const handle=app({VERCEL_ENV:'preview'})
  for(const origin of ['https://attacker.example.test','null']){
    assert.equal((await handle(req('/api/projects/prepare','POST',{origin}))).status,403)
    assert.equal((await handle(req('/api/auth/login','POST',{origin}))).status,403)
  }
  assert.equal((await handle(req('/api/projects/prepare','POST',{origin:'https://app.example.test'}))).next,true)
})
