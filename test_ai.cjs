const dotenv = require('dotenv');
dotenv.config({path: '.env.local'});

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('No API key');
    return;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = "ؚако наставник по математика, објасни му на ученик ЗОШТО го направивме овој чекор во контекст на задачата.\n    Задача: 2x + 4 = 10\n    Чекор: Одземаме 4 од двете страни (2x = 6)\n    Објасни го математичкото правило во 2 кратки реченици на македонски јазик.";
  try {
    console.log('Calling...');
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
  } catch(e) {
    console.log('Error', e);
  }
}

testAI();
