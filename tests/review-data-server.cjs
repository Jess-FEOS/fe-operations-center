// Local-only, read-only PostgREST fixture server. Never use in a deployment.
// QA_DATA_FILE must point to a private snapshot outside the tracked repository.
const http=require('node:http'),fs=require('node:fs')
const data=JSON.parse(fs.readFileSync(process.env.QA_DATA_FILE,'utf8'))
function fields(s){const out=[];let depth=0,from=0;for(let i=0;i<s.length;i++){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(s[i]===','&&depth===0){out.push(s.slice(from,i));from=i+1}}out.push(s.slice(from));return out}
function shape(row,select){
  if(!select || select==='*')return {...row}
  const result={}
  for(const part of fields(select)){
    if(part==='*'){Object.assign(result,row);continue}
    if(part.includes('(')){
      const match=part.match(/^([^(!:]+)(?:![^(]+)?\((.*)\)$/)
      if(!match)continue
      const [,table,cols]=match
      const key={projects:'project_id',roles:'role_id',vendor_roles:'vendor_role_id',monthly_priorities:'priority_id',campaigns:'campaign_id'}[table]
      const joined=(data[table]||[]).find(r=>r.id===row[key])
      result[table]=joined?shape(joined,cols):null
    }else result[part]=row[part]??null
  }return result
}
function value(row,key){if(!key.includes('.'))return row[key];const [table,col]=key.split('.');const fk={projects:'project_id'}[table];return (data[table]||[]).find(r=>r.id===row[fk])?.[col]}
const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json')
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(403);return res.end(JSON.stringify({message:'Local snapshot cannot be modified.'}))}
  const url=new URL(req.url,'http://127.0.0.1')
  const table=url.pathname.split('/').pop()
  let rows=[...(data[table]||[])]
  for(const [key,filter] of url.searchParams){
    if(['select','order','limit','offset'].includes(key))continue
    const dot=filter.indexOf('.'),op=filter.slice(0,dot),arg=filter.slice(dot+1)
    rows=rows.filter(row=>{
      const v=value(row,key)
      if(op==='eq')return String(v)===arg
      if(op==='neq')return String(v)!==arg
      if(op==='gte')return v!=null&&v>=arg
      if(op==='lte')return v!=null&&v<=arg
      if(op==='lt')return v!=null&&v<arg
      if(op==='in')return arg.slice(1,-1).split(',').map(s=>s.replaceAll('"','')).includes(String(v))
      if(op==='is')return arg==='null'?v==null:String(v)===arg
      if(op==='not')return arg==='is.null'?v!=null:true
      return true
    })
  }
  const orders=(url.searchParams.get('order')||'').split(',').filter(Boolean)
  rows.sort((a,b)=>{for(const rule of orders){const [key,dir]=rule.split('.');const cmp=String(a[key]??'').localeCompare(String(b[key]??''),undefined,{numeric:true});if(cmp)return dir==='desc'?-cmp:cmp}return 0})
  const count=rows.length
  if(url.searchParams.has('limit'))rows=rows.slice(0,Number(url.searchParams.get('limit')))
  rows=rows.map(row=>shape(row,url.searchParams.get('select')))
  res.setHeader('Content-Range',`0-${Math.max(0,count-1)}/${count}`)
  if(req.headers.accept?.includes('vnd.pgrst.object')){
    if(rows.length!==1){res.writeHead(406);return res.end(JSON.stringify({message:'Expected one record',code:'PGRST116'}))}
    return res.end(JSON.stringify(rows[0]))
  }
  res.end(JSON.stringify(rows))
})
server.listen(4400,'127.0.0.1',()=>console.log('Read-only private snapshot server ready on 4400'))
