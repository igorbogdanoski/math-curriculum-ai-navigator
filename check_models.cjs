const fetch = require('node-fetch');
const API_KEY = 'AIzaSyB706Nvbwtstr4OSfrqxUJwJ2_0UKhNlac';

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
      console.log('✅ Dostapni Gemini modeli:');
      data.models.forEach(model => {
        console.log(`- ${model.name}`);
      });
    } else {
      console.error('❌ Nema modeli ili API klučot ne e validen:', data);
    }
  } catch (error) {
    console.error('❌ Greška:', error);
  }
}

listModels();
