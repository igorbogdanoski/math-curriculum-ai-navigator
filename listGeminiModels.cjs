const fetch = require('node-fetch');

const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY'; // Zameni so tvojot kluch ili koristi ENV

fetch('https://generativelanguage.googleapis.com/v1/models', {
  headers: { 'Authorization': `Bearer ${API_KEY}` }
})
  .then(res => res.json())
  .then(data => {
    if (data.models) {
      console.log('Dostapni Gemini modeli:');
      data.models.forEach(model => console.log(model.name));
    } else {
      console.error('Nema modeli ili API kluchot ne e validen:', data);
    }
  })
  .catch(err => console.error('Greshka:', err));
