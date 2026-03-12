
require('dotenv').config();
const fetch = require('node-fetch');

const API_KEY = process.env.GEMINI_API_KEY;

fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`)
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
