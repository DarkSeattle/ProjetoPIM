import fetch from 'node-fetch';
import 'dotenv/config';

export async function perguntarIA(pergunta) {
  if (!pergunta) return "Pergunta vazia.";

  if (!process.env.GEMINI_API_KEY) {
    console.error("⚠️ GEMINI_API_KEY não encontrada no .env");
    return "Não consegui responder.";
  }

  try {
    console.log("📩 Enviando pergunta para a IA:", pergunta);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          contents: [{ parts: [{ text: pergunta }] }]
        })
      }
    );

    console.log("🔹 Status da resposta da API:", response.status, response.statusText);
    if (!response.ok) {
      console.error("⚠️ Erro na API Gemini:", response.status, response.statusText);
      return "Não consegui responder.";
    }

    const data = await response.json();
    console.log("🔍 Retorno completo da API:", JSON.stringify(data, null, 2));

const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resposta || resposta.trim() === "") {
      console.warn("⚠️ A API retornou resposta vazia");
      return "Não consegui responder.";
    }

    console.log("✅ Resposta da IA:", resposta);
    return resposta;

  } catch (err) {
    console.error("Erro ao chamar a IA:", err);
    return "Não consegui responder.";
  }
}
