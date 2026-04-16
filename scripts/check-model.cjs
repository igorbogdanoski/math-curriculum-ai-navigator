'use strict';
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const keyMatch = envContent.match(/(?:GEMINI_API_KEY|VITE_GEMINI_API_KEY)=(.+)/);
const key = keyMatch ? keyMatch[1].trim() : null;
if (!key) { console.error('No API key found'); process.exit(1); }
console.log('API key prefix:', key.substring(0, 8) + '...');

const https = require('https');
const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + key;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const models = (parsed.models || [])
        .filter(m => m.name.includes('flash') || m.name.includes('pro'))
        .map(m => m.name);
      console.log('Available flash/pro models:');
      models.forEach(m => console.log(' ', m));
    } catch(e) {
      console.log('Raw response (first 500 chars):', data.substring(0, 500));
    }
  });
}).on('error', e => console.error(e));
