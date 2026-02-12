export const useVoice = () => {
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'mk-MK';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };
  return { speak, stop: () => window.speechSynthesis.cancel() };
};
