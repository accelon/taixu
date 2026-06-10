import {filesFromPattern, readTextContent, writeChanged,nodefs,readTextLines,toBase26} from './nodebundle.cjs' //from ptk/nodebundle.cjs
await nodefs
import fs from 'fs';

const sourcefolder='./xml/';

const files=filesFromPattern(sourcefolder+'*.xml');
const outfolder='./taixu/';
let activefolder='',activesubfolder='',articletree='';
let filecount=0, vol=0,page=0,lineoff=0,mermaidline='';

//todo , additional title  甲、xxxx  (two full-width space)  normal text

const mermaidstyle=`%%{init: {
  'flowchart': {
    'nodeSpacing': 12 ,
    'padding':1,
    'rankSpacing': 12,
    'useMaxWidth': false,
    'diagramPadding': 0,
    'nodePadding':1  ,
    'labelPadding':1
  }
}}%%`
const accelon3markdown=(title,content,tree)=>{
    const out=[];
    let insertblockid=0,isheader=false,preformat=false,insertlineoff=0,removableTOC=false;
    //let hide=false;
    for (let i=0;i<content.length;i++) {
        let line=content[i];
        
        line=line.replace(/<註 n="([\d\-]+)"\/>（註([一二三四五六七八九十]+)）/g,(m,num,chin)=>{
            return '[^'+num+']';
        });
        line=line.replace(/<釋 n="([\d\-]+)">（註([一二三四五六七八九十]+)）/g,(m,num,chin)=>{
            return '\n[^'+num+']: ';
        });
        line=line.replace(/<\/釋>/g,'\n');

        const m=line.match(/<頁 id="(\d+)p(\d+)"\/>/);
        isheader=false;
        if (m){
            vol=parseInt(m[1]);
            page=parseInt(m[2]);
            lineoff=-1;
            line='';
            isheader=true; //把頁碼也當作標題
        } else {
            if (line.startsWith('<')){                
                if (line.startsWith('<段')) {
                    if(out[insertblockid]) out[insertblockid] += ' ^'+vol.toString()+'p'+page.toString()+(insertlineoff?toBase26(insertlineoff||0):'');
                    line=line.replace(/<段\/>/,'');

                    const reg=/^([一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])、(.+?)　　/;
                    const m=line.match(reg);
                    if (m){
                        let depth=tree.length+1;
                        if (depth>6) {
                            // console.log('exceed depth',title,depth);
                            depth=6;
                        }
                        line='\n'+'#'.repeat(depth)+' '+m[1]+'、'+m[2]+'\n'+line.replace(reg,'');
                    } else {
                        line='\n'+line;
                    }
                } else {
                    for (let j=0;j<tree.length;j++) {
                        if (tree[j] && line.startsWith('<'+tree[j])) {
                            const g=new RegExp('<\\/?'+tree[j]+'.*?>　*','g');
                            let depth=j+1;
                            if (depth>6) {
                                // console.log('exceed depth',title,depth);
                                depth=6;
                            }
                            line='\n'+'#'.repeat(depth)+' '+line.replace(g,'\n').trim();
                            isheader=true;
                        }
                    }
                }
                if (line.startsWith('<圖')) {
                    const m=line.match(/<圖 n="(.+?)">/);
                    const png=m[1];
                    line='\n'+'[['+png+'|'+png.replace('images/','').replace('.png','')+']]';
                    const mermaidfile=png.replace('images/','mermaid/').replace('.png','.md');
                    if (fs.existsSync(mermaidfile)){
                        out.push(line)
                        line='';
                        let md=readTextContent(mermaidfile);
                        if (md.indexOf('%%{')===-1) {
                            md=md.replace(/```mermaid\n/g,'```mermaid'+'\n'+mermaidstyle+'\n');
                        }
                        mermaidline+='\n'+md+'\n';
                    } else {
                        // console.log('no mermaid', line)
                        mermaidline='';
                        preformat=true;
                    }
                }
                else if (line.startsWith('</圖')) {
                    preformat=false;
                    line=mermaidline;
                    mermaidline='';
                }
            }

        }
        if(~line.indexOf('<次>')) removableTOC=true;
        lineoff++;
        if (!isheader) {
            insertlineoff=lineoff;
            insertblockid=out.length;
        }
        if (removableTOC) {
            line='';
        }
        line=line.replace(/<品>/g,'\n==');
        line=line.replace(/<\/品>/g,'==\n');
        line=line.replace(/<\/檔>/g,'');

        line=line.replace(/<偈>/g,'> ');
        line=line.replace(/<經文>/g,'> ');
        line=line.replace(/<\/經文>/g,'');
        line=line.replace(/<\/偈>/g,'');
        if(line&&!mermaidline) out.push(line+(preformat?'':'●')); //add a marker to indicate normal text line break, will be removed later
        if(~content[i].indexOf('</次>')) removableTOC=false;
    }
    return out.join('\n').replace(/●\n?/g,'').split(/\n/);
}
const processArticle=(title,content)=>{
    const folder=outfolder+activefolder+'/'+(activesubfolder?activesubfolder+'/':'');
    filecount++;
    //if (filecount>11) return;
    const tree=articletree.split(',');
    const md=accelon3markdown(title,content,tree);
    writeChanged(folder+title+'.md',md.join('\n'));
}

const createfolders=(l)=>{
    if (l.startsWith("<編")){
        const reg =/<編 n="(\d+)".+?>(.+?)<\/編>/
        const m=l.match(reg);
        const n=m[1];
        const title=n.toString().padStart(2, '0') + m[2].replace(/第.+編[　 ]+/,'');
        if (!fs.existsSync(outfolder+title)) {
            fs.mkdirSync(outfolder+title);
        }
        activefolder=title;
        activesubfolder='';
        return l.replace(reg,'')
    }
    if (l.startsWith("<類")){
        const reg =/<類.*>(.+?)<\/類>/;
        const m=l.match(reg);
        const title=m[1].replace(/[《》　]/g,'');
        if (title!=='律釋') {
            if (!fs.existsSync(outfolder+activefolder+'/'+title)) {
                fs.mkdirSync(outfolder+activefolder+'/'+title);
            }
            activesubfolder=title;//律釋不分子文件夾
        }
        return l.replace(reg,'')
    }
    return l;

}

for (let i=0;i<files.length;i++) {
    const filename=files[i];
    const rawlines=readTextLines(filename);
    if (filename.endsWith('taixu12.xml')) {
        const appendlines=readTextLines(filename.replace('12','13'));
        appendlines.shift();appendlines.shift();appendlines.shift();//drop first 3 lines
        rawlines.push(...appendlines);
    }
    if (filename.endsWith('taixu13.xml')) continue;//combined with taixu12

    let articlecontent=[];
    let title='header';
    for (let j=0;j<rawlines.length;j++) {
        let l=rawlines[j];
        l=createfolders(l);
        const reg =/<文(.*?)>(.+?)<\/文>/;
        const m=l.match(reg);
        if (!m) {
            articlecontent.push(l)
        } else {
            processArticle(title,articlecontent);
            const m2=m[1].match(/t="(.+?)\.?"/);

            articletree=(m2&& m2[1])||'章,節';//此文章之結構樹
            title=m[2];
            articlecontent=[];
        }
    }
    processArticle(title,articlecontent);
};