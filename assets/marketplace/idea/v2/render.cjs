// Marketplace layouts composed from unmodified native IntelliJ IDEA captures.
// Run: NODE_PATH=<path containing sharp> node render.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = __dirname;
const W = 1920, H = 1200;
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const png = name => `data:image/jpeg;base64,${fs.readFileSync(path.join(root, 'raw', name)).toString('base64')}`;
const logo = fs.readFileSync(path.resolve(root, '../../../../icon.svg'), 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '');
const type = (x,y,s,size=54,color='#F3F4F7',weight=600) => `<text x="${x}" y="${y}" font-family="Avenir Next,Helvetica Neue,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="-.8">${esc(s)}</text>`;
const rect = (x,y,w,h,fill,rx=0,stroke='none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
const image = (file,x,y,w,h,vb,clip) => `<g${clip ? ` clip-path="url(#${clip})"` : ''}><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="xMidYMid slice"><image xlink:href="${png(file)}" width="${file === 'commit-before-after.jpg' ? 880 : 3420}" height="${file === 'commit-before-after.jpg' ? 506 : 1984}"/></svg></g>`;
function frame(title,content,desc) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>Git AI — ${esc(title)}</title><desc>${esc(desc)}</desc><defs><clipPath id="screen"><rect x="52" y="172" width="1816" height="976" rx="18"/></clipPath><clipPath id="detail"><rect x="350" y="386" width="1220" height="438" rx="17"/></clipPath><filter id="shadow" x="-30%" y="-50%" width="160%" height="220%"><feDropShadow dx="0" dy="20" stdDeviation="32" flood-color="#000" flood-opacity=".55"/></filter></defs>${rect(0,0,W,H,'#101113')}${type(60,111,title)}<g transform="translate(1662 63) scale(1.7)" fill="#F3F4F7">${logo}</g>${type(1720,99,'Git AI',32,'#DADCE2',600)}${content}${rect(52,172,1816,976,'none',18,'#34363B')}</svg>`;
}
const slides = [
  {
    name: '01-ai-commit-messages', title: 'Commit now. Keep coding.',
    caption: 'Commit now. Keep coding. — AI commit messages for IntelliJ IDEA',
    svg: frame('Commit now. Keep coding.',
      image('history-updated.jpg',52,172,1816,976,'0 0 3420 1984','screen')+
      rect(52,172,1816,976,'#090A0C55',18)+
      `<g filter="url(#shadow)">${rect(286,408,1348,316,'#23252A',16,'#505258')}</g>`+
      type(342,475,'YOUR DRAFT',20,'#9FA3AD',500)+
      `<text x="342" y="583" font-family="Menlo,monospace" font-size="60" fill="#F3F4F7">c</text>`+
      `<path d="M559 456V676" stroke="#494C55"/><path d="M587 565h32m-9-9 9 9-9 9" stroke="#8BAAFF" stroke-width="2" fill="none"/>`+
      type(660,475,'AI-POLISHED COMMIT',20,'#9FA3AD',500)+
      `<text x="660" y="550" font-family="Menlo,monospace" font-size="31" fill="#D2E1FF">feat(i18n): add internationalization</text>`+
      `<text x="660" y="598" font-family="Menlo,monospace" font-size="31" fill="#F3F4F7">support for Git AI plugin</text>`+
      type(660,669,'Actual result · commit 8343449',18,'#9FA3AD',400),
      'Real IntelliJ IDEA screenshot with a clearly separate marketing annotation quoting a verified commit. Actual original draft: c. Actual polished subject: feat(i18n): add internationalization support for Git AI plugin. The comparison annotation is not a simulated IDE dialog.'),
  },
  {
    name: '02-ai-commit-history', title: 'Every AI commit, in view.',
    caption: 'Every AI commit, in view. — Native Git AI history',
    svg: frame('Every AI commit, in view.',
      image('history-featured.jpg',52,172,1816,976,'40 824 2102 1130','screen'),
      'Unmodified native Git AI history in IntelliJ IDEA, cropped to the editor and tool window. The highlighted commit is the same real AI-polished commit shown in image 1.'),
  },
  {
    name: '03-native-git-ai-controls', title: 'Retry. Undo. Stay in control.',
    caption: 'Retry. Undo. Stay in control. — Native IntelliJ IDEA actions',
    svg: frame('Retry. Undo. Stay in control.',
      image('status.jpg',52,172,1816,976,'40 824 2102 1130','screen'),
      'Unmodified native Git AI status and actions in IntelliJ IDEA, cropped to the editor and tool window. Shows retry, undo, cancel, push and skip actions.'),
  },
];
(async () => {
  for (const dir of ['source','png']) fs.mkdirSync(path.join(root,dir),{recursive:true});
  for (const s of slides) {
    fs.writeFileSync(path.join(root,'source',s.name+'.svg'),s.svg);
    await sharp(Buffer.from(s.svg)).flatten({background:'#101113'}).png({compressionLevel:9}).toFile(path.join(root,'png',s.name+'.png'));
    const m = await sharp(path.join(root,'png',s.name+'.png')).metadata();
    console.log(`${s.name}: ${m.width} × ${m.height}, ${m.channels} channels`);
  }
  const thumbs = await Promise.all(slides.map(s=>sharp(path.join(root,'png',s.name+'.png')).resize(960,600).png().toBuffer()));
  await sharp({create:{width:1920,height:1200,channels:3,background:'#202125'}}).composite(thumbs.map((input,i)=>({input,left:(i%2)*960,top:Math.floor(i/2)*600}))).png().toFile(path.join(root,'contact-sheet.png'));
  fs.writeFileSync(path.join(root,'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Git AI · IDEA Marketplace 截图</title><style>*{box-sizing:border-box}body{margin:0;background:#101113;color:#e8e9ed;font:16px -apple-system,BlinkMacSystemFont,sans-serif}main{max-width:1400px;margin:auto;padding:52px 32px}h1{font-weight:600;letter-spacing:-1px;font-size:34px}p{color:#a2a5ae;line-height:1.7}a{color:#a8c9ff}figure{margin:42px 0 64px}img{display:block;width:100%;border-radius:12px}figcaption{display:flex;justify-content:space-between;margin-top:16px;gap:20px}nav{display:flex;gap:24px;margin:24px 0}small{color:#979aa3}</style><main><h1>Git AI · IDEA Marketplace 截图</h1><p>真实 IDEA 界面，1920 × 1200 PNG。按顺序上传以下三张。<br>首图用对比说明层展示真实提交前后变化；其余图片聚焦历史和操作。</p><nav><a href="git-ai-idea-screenshots-v2.zip" download>下载全部 PNG</a><a href="upload-guide.txt">标题、说明与上传建议</a></nav>${slides.map((s,i)=>`<figure><img src="png/${s.name}.png" alt="${esc(s.caption)}"><figcaption><span>0${i+1} · ${esc(s.title)}</span><a href="png/${s.name}.png" download>下载 PNG</a></figcaption></figure>`).join('')}<small>原生界面语言为简体中文，展示标题为英文。来源为本机已安装的 Git AI 插件；放大、取景和标题不改变原始界面或提交数据。</small></main></html>`);
})();
