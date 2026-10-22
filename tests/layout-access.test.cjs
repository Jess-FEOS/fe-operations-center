const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
function compile(file,box){
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}
  }).outputText,box)
  return box.exports
}
const policy=compile(__dirname+'/../src/lib/access-policy.ts',{exports:{},URL})
function render(env){
  const {default:Layout}=compile(__dirname+'/../src/app/layout.tsx',{
    exports:{},process:{env},require(name){
      if(name==='./globals.css')return {}
      if(name==='@/components/TopNav')return {default:()=>React.createElement('nav',null,'Navigation')}
      if(name==='@/lib/access-policy')return policy
      if(name==='react/jsx-runtime')return require(name)
      throw Error(name)
    }
  })
  return renderToStaticMarkup(React.createElement(Layout,null,React.createElement('p',null,'Page content')))
}
for(const [name,env,expected] of [
  ['production default',{VERCEL_ENV:'production'},false],
  ['production explicit writes',{VERCEL_ENV:'production',OPS_WRITES_ENABLED:'true'},false],
  ['production explicit freeze',{VERCEL_ENV:'production',OPS_WRITES_ENABLED:'false'},true],
  ['preview default',{VERCEL_ENV:'preview'},true],
  ['preview inherited writes',{VERCEL_ENV:'preview',OPS_WRITES_ENABLED:'true'},true],
  ['local review overrides writes',{VERCEL_ENV:'production',OPS_LOCAL_REVIEW:'true',OPS_WRITES_ENABLED:'true'},true],
  ['unknown environment',{},true],
  ['explicit local writes',{OPS_WRITES_ENABLED:'true'},false],
]){
  test(`layout banner matches write policy: ${name}`,()=>{
    const html=render(env)
    assert.equal(html.includes('Foundation review'),expected)
    assert.equal(html.includes('Foundation review'),policy.isReadOnly(env))
    assert.match(html,/Page content/)
  })
}
