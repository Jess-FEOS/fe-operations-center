import { unzipSync, strFromU8 } from 'fflate'
import { MAX_FILE, MAX_INPUT } from './update-intake'

export async function readTranscriptFile(file:File):Promise<string> {
  if(!file.size)throw new Error('This file is empty.')
  if(file.size>MAX_FILE)throw new Error('Choose a file smaller than 2 MB.')
  const extension=file.name.split('.').pop()?.toLowerCase()
  let result=''
  if(['txt','md','vtt','srt','json'].includes(extension || ''))result=await file.text()
  else if(extension==='docx') {
    // Extract only bounded document XML, never HTML, attachments, macros or links.
    let tooLarge=false
    const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{
      if(entry.name!=='word/document.xml')return false
      if(entry.originalSize>4*1024*1024){tooLarge=true;return false}
      return true
    }})
    if(tooLarge)throw new Error('This Word document expands beyond the safe text limit.')
    const xml=entries['word/document.xml']
    if(!xml)throw new Error('This is not a readable Word .docx document.')
    const content=strFromU8(xml)
    if(/<!DOCTYPE|<!ENTITY/i.test(content))throw new Error('This Word document contains unsupported XML declarations.')
    const document=new DOMParser().parseFromString(content,'application/xml')
    if(document.getElementsByTagName('parsererror').length)throw new Error('The Word document could not be read.')
    result=Array.from(document.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','p'))
      .map(p=>Array.from(p.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main','t')).map(t=>t.textContent || '').join('')).join('\n')
  } else throw new Error('Supported files: TXT, MD, VTT, SRT, JSON and DOCX. Export PDF or audio/video to a text transcript first.')
  if(result.includes('\0'))throw new Error('This does not look like a text transcript. Export it as UTF-8 text.')
  if(!result.trim())throw new Error('No readable text was found. Images and recordings are not transcribed here.')
  if(result.length>MAX_INPUT)throw new Error('Keep each upload under 80,000 characters. Split long meetings into smaller sections.')
  return result.trim()
}
