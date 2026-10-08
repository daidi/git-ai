// Editable, code-native Marketplace artwork. No IDE screenshots are simulated.
// Run with Node.js and sharp available on NODE_PATH: node render.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const out = __dirname;
const icon = fs.readFileSync(path.resolve(out, '../../icon.png')).toString('base64');
const esc = v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const C = {bg:'#F5F3EF', ink:'#1D1D25', sub:'#66636E', line:'#DAD6D0', violet:'#6D4AFF', panel:'#202129', green:'#B9F77B', pale:'#EAE5FF', mute:'#B8B7C2'};
const rect=(x,y,w,h,fill,rx=0,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
const text=(x,y,s,size=24,fill=C.ink,weight=400,mono=false)=>`<text x="${x}" y="${y}" font-family="${mono?'Menlo':'Avenir Next'}, sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(s)}</text>`;
const line=(x1,y1,x2,y2,col=C.line,width=1)=>`<path d="M${x1} ${y1}H${x2}" stroke="${col}" stroke-width="${width}"/>`;
const pathLine=(d,col=C.line,w=2)=>`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circle=(x,y,r,fill,stroke='none',sw=2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const check=(x,y,col=C.green)=>circle(x,y,17,col)+pathLine(`M${x-7} ${y}l5 5 9-10`,C.panel,2.5);
const arrow=(x,y,col=C.violet)=>pathLine(`M${x} ${y}h42m-10-10 10 10-10 10`,col,3);
const label=(x,y,s,col=C.sub)=>`<text x="${x}" y="${y}" font-family="Avenir Next, sans-serif" font-size="18" font-weight="600" letter-spacing="2" fill="${col}">${esc(s)}</text>`;
const pill=(x,y,w,s,fill=C.pale,col=C.violet)=>rect(x,y,w,40,fill,20)+text(x+18,y+27,s,18,col,600);
function frame(n,section,body,dark=false){
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-labelledby="title desc"><title id="title">Git AI — ${esc(section)}</title><desc id="desc">Feature overview for Git AI for JetBrains IDEs. Informational artwork, not an IDE screenshot. Commit messages are illustrative examples.</desc>${rect(0,0,1600,1000,dark?'#16171E':C.bg)}<image href="data:image/png;base64,${icon}" x="64" y="43" width="52" height="52"/>${text(132,78,'Git AI',30,dark?'#FFFFFF':C.ink,650)}${text(253,77,'FOR JETBRAINS IDEs',18,dark?C.mute:C.sub,600)}${label(1270,76,`0${n} / ${section.toUpperCase()}`,dark?C.mute:C.sub)}${line(64,121,1536,121,dark?'#3B3B45':C.line)}${body}${line(64,921,1536,921,dark?'#3B3B45':C.line)}${text(64,959,'AI commit messages · IntelliJ IDEA & compatible JetBrains IDEs',20,dark?C.mute:C.sub)}${text(1250,959,'FEATURE OVERVIEW',17,dark?C.mute:C.sub,600)}</svg>`;
}
const slides=[];
slides.push({name:'01-git-ai-async-commit-messages',title:'Commit now. Keep coding.',svg:frame(1,'Workflow',
 label(64,194,'AI COMMIT MESSAGE GENERATOR')+
 text(60,298,'Commit now.',89,C.ink,650)+text(60,394,'Keep coding.',89,C.violet,650)+
 text(66,459,'Turn a quick draft into a clear commit',27)+text(66,501,'message while you work on what’s next.',27)+
 pill(65,552,231,'Background polishing')+
 text(66,662,'Your normal commit flow.',25,C.ink,600)+text(66,703,'No waiting for a model to finish.',25,C.sub)+
 rect(714,168,822,620,C.panel,24)+label(754,220,'ILLUSTRATIVE COMMIT EXAMPLE',C.mute)+
 text(754,279,'YOU COMMIT',18,C.mute,600)+text(754,337,'"fix login"',42,'#FFFFFF',500,true)+
 pathLine('M781 372v69',C.violet,3)+circle(781,408,8,C.violet)+text(806,414,'AI polishes in the background',23,C.mute)+
 rect(744,456,762,216,'#30363A',16)+label(774,503,'CONVENTIONAL COMMIT',C.green)+
 text(774,564,'fix(auth): handle expired',33,'#FFFFFF',500,true)+text(774,614,'sessions on login',33,'#FFFFFF',500,true)+
 check(771,729)+text(802,738,'The original commit is saved before AI starts.',23,'#FFFFFF')+
 line(65,819,1536,819)+label(65,863,'COMMIT FIRST. THINK LATER.')+text(714,865,'Native IDE actions  /  Terminal  /  Commit and Push',24,C.sub)
)});
slides.push({name:'02-git-ai-native-controls-history',title:'Stay in control. Inside your IDE.',svg:frame(2,'Control',
 text(64,229,'Stay in control. Inside your IDE.',70,C.ink,650)+
 text(67,281,'See progress, inspect AI history, and choose what happens next.',28,C.sub)+
 rect(64,334,920,520,C.panel,24)+label(102,384,'NATIVE TOOL WINDOW · FEATURE MAP',C.mute)+
 line(104,414,944,414,'#41414D')+
 circle(124,469,8,C.green)+text(151,479,'Status',31,'#FFFFFF',600)+text(378,476,'Follow polishing and queued pushes.',24,C.mute)+
 line(104,519,944,519,'#41414D')+
 circle(124,574,8,'#BAACFF')+text(151,584,'AI History',31,'#FFFFFF',600)+text(378,581,'Inspect drafts, models, and latency.',24,C.mute)+
 line(104,624,944,624,'#41414D')+
 circle(124,679,8,'#88C8FA')+text(151,689,'Productivity',31,'#FFFFFF',600)+text(378,686,'Review local estimates of time saved.',24,C.mute)+
 line(104,729,944,729,'#41414D')+
 circle(124,784,8,'#FFCA82')+text(151,794,'Logs',31,'#FFFFFF',600)+text(378,791,'Read diagnostic logs in the IDE.',24,C.mute)+
 label(1032,372,'YOU DECIDE')+
 text(1030,432,'Retry AI Polish',34,C.ink,600)+text(1031,470,'Generate another message.',24,C.sub)+line(1032,498,1536,498)+
 text(1030,553,'Undo AI Polish',34,C.ink,600)+text(1031,591,'Restore your original draft.',24,C.sub)+line(1032,619,1536,619)+
 text(1030,674,'Cancel Polishing',34,C.ink,600)+text(1031,712,'Stop active AI work.',24,C.sub)+line(1032,740,1536,740)+
 text(1030,795,'Skip AI',34,C.ink,600)+text(1031,833,'Keep the next commit untouched.',24,C.sub)
)});
slides.push({name:'03-git-ai-providers-commit-styles',title:'Your model. Your commit style.',svg:frame(3,'Customize',
 text(64,229,'Your model. Your commit style.',74,C.ink,650)+text(67,282,'Configure providers, formats, and output language in Tools → Git AI.',28,C.sub)+
 label(66,365,'CONNECT YOUR MODEL')+line(64,392,653,392)+
 text(65,443,'OpenAI-compatible APIs',32,C.ink,600)+text(65,480,'OpenAI · DeepSeek · Qwen · custom endpoints',23,C.sub)+
 line(64,512,653,512)+text(65,563,'Anthropic / Google',32,C.ink,600)+text(65,600,'Native Claude and Gemini API support',23,C.sub)+
 line(64,632,653,632)+text(65,683,'Ollama',32,C.ink,600)+text(65,720,'Run a model locally on your machine',23,C.sub)+
 rect(65,779,588,82,C.pale,14)+text(87,813,'Bring your own key for cloud providers.',22,C.violet,500)+text(87,844,'Local Ollama can run without an API key.',22,C.violet,500)+
 rect(700,334,836,534,C.panel,24)+label(740,383,'CHOOSE YOUR FORMAT · EXAMPLES',C.mute)+
 text(740,438,'Conventional Commits',22,C.green,600)+text(740,483,'feat(api): add cursor pagination',26,'#FFFFFF',400,true)+
 line(740,512,1496,512,'#41414D')+
 text(740,554,'Gitmoji',22,'#BAACFF',600)+text(740,595,'✨ feat(api): add cursor pagination',25,'#FFFFFF',400,true)+
 line(740,623,1496,623,'#41414D')+
 text(740,665,'Plain',22,'#88C8FA',600)+text(740,706,'Add cursor pagination to the API',26,'#FFFFFF',400,true)+
 line(740,734,1496,734,'#41414D')+
 text(740,776,'Subject + body',22,'#FFCA82',600)+text(740,817,'A concise subject, plus the what and why.',24,'#FFFFFF')
)});
slides.push({name:'04-git-ai-recorded-commit-safety',title:'Better messages. Your changes preserved.',svg:frame(4,'Git safety',
 text(64,229,'Better messages.',78,'#FFFFFF',650)+text(64,319,'Your changes preserved.',78,C.green,650)+
 text(67,378,'Polishing uses the recorded commit. Newer staged work stays separate.',28,C.mute)+
 rect(64,438,650,247,'#23252E',20,'#40424E')+label(101,484,'ORIGINAL COMMIT',C.mute)+
 text(103,541,'Draft message',33,'#FFFFFF',550)+text(103,592,'Recorded tree + parents',26,C.mute,400,true)+
 pill(103,621,294,'Saved before AI starts','#343844',C.mute)+
 arrow(778,560,C.green)+
 rect(886,438,650,247,'#26332B',20,'#618548')+label(923,484,'REPLACEMENT COMMIT',C.green)+
 text(925,541,'AI-polished message',33,'#FFFFFF',550)+text(925,592,'Same tree + parents',26,C.mute,400,true)+
 pill(925,621,401,'Applied only if ref is unchanged','#354B32',C.green)+
 check(86,756)+text(118,765,'If the branch has moved',27,'#FFFFFF',600)+text(118,807,'The update safely stops.',24,C.mute)+
 check(647,756)+text(679,765,'If the model fails',27,'#FFFFFF',600)+text(679,807,'Your original commit remains.',24,C.mute)+
 check(1187,756)+text(1219,765,'If you prefer the draft',25,'#FFFFFF',600)+text(1219,807,'Use Undo AI Polish.',24,C.mute)+
 text(67,875,'Newer index and worktree changes are never used to build the replacement commit.',21,C.mute)
,true)});

(async()=>{
 fs.mkdirSync(path.join(out,'source'),{recursive:true});
 fs.mkdirSync(path.join(out,'png'),{recursive:true});
 for(const s of slides){
  fs.writeFileSync(path.join(out,'source',s.name+'.svg'),s.svg);
  await sharp(Buffer.from(s.svg)).flatten({background:C.bg}).png({compressionLevel:9}).toFile(path.join(out,'png',s.name+'.png'));
  const m=await sharp(path.join(out,'png',s.name+'.png')).metadata();
  console.log(`${s.name}: ${m.width} × ${m.height}, ${m.channels} channels`);
 }
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Git AI · Marketplace media</title><style>body{margin:0;background:#eae7e1;color:#202129;font:17px 'Avenir Next',sans-serif}main{max-width:1200px;margin:48px auto;padding:0 24px}h1{font-size:38px;margin-bottom:12px}p{line-height:1.7;color:#64616b}figure{margin:34px 0 56px}img{display:block;width:100%;border-radius:10px;box-shadow:0 10px 32px #2221}figcaption{display:flex;justify-content:space-between;margin-top:16px}a{color:#6446dc}footer{margin-bottom:60px}</style><main><h1>Git AI · Marketplace 展示素材</h1><p>4 张英文功能介绍图，1600 × 1000 PNG。按以下顺序上传。<br>这些是功能说明图，不是 IDEA 实拍截图；建议与真实 IDE 截图搭配使用。</p>${slides.map((s,i)=>`<figure><img src="png/${s.name}.png" alt="${esc(s.title)}"><figcaption><span>0${i+1} — ${esc(s.title)}</span><a href="png/${s.name}.png" download>下载 PNG</a></figcaption></figure>`).join('')}<footer><a href="upload-guide.txt">上传顺序与 SEO 文案</a> · <a href="https://plugins.jetbrains.com/docs/marketplace/best-practices-for-listing.html#screenshots">JetBrains 官方展示规范</a></footer></main></html>`);
})();
