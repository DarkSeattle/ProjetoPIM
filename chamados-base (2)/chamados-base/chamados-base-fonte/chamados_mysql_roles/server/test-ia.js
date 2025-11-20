import { perguntarIA } from './ia.js';

async function main() {
  const resposta = await perguntarIA("Olá, você pode me ajudar com um problema no computador?");
  console.log("Resposta da IA:", resposta);
}

main();
