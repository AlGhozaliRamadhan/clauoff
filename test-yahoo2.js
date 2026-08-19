const fs = require('fs');

fetch('https://search.yahoo.com/search?p=fun+facts+about+bunnies', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
}).then(r => r.text()).then(html => {
  const resultRegex = /<div class="[^"]*algo(?:-sr)?[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let count = 0;
  let match;
  while ((match = resultRegex.exec(html)) && count < 5) { 
    count++;
    console.log('Match length:', match[1].length); 
    const block = match[1];
    const linkMatch = block.match(/<a[^>]*href="([^"]+)"/i);
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const snippetMatch = block.match(/<div class="[^"]*compText[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    let rawUrl = linkMatch ? linkMatch[1] : '';
    const realUrlMatch = rawUrl.match(/\/RU=([^\/]+)/);
    if (realUrlMatch) {
      rawUrl = decodeURIComponent(realUrlMatch[1]);
    }
    let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    console.log({title, url: rawUrl, snippet: snippet.substring(0, 100)});
  }
  console.log('Total matches:', count);
}).catch(console.error);
