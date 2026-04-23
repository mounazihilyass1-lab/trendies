import { GoogleGenAI, Type } from "@google/genai";

// Lazy-initialize the API to prevent crashes if the key is missing during build or startup
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is missing. Please add it to your project settings/environment variables.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateSuggestions(): Promise<string[]> {
  const ai = getAI();
  if (!ai) throw new Error("AI Service not configured: Please add GEMINI_API_KEY to your project settings.");

  try {
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    });

    const prompt = `Génère une liste de 5 sujets de tendances actuelles MAJEURES sur les réseaux sociaux francophones (TikTok, Twitter, Instagram). 
    Utilise Google Search pour trouver des événements réels de moins de 24h.
    Réponds uniquement avec un tableau JSON de chaînes de caractères.
    Exemple de format: ["Sujet 1", "Sujet 2", "Sujet 3", "Sujet 4", "Sujet 5"]`;
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} } as any],
    });

    const response = await result.response;
    const text = response.text();
    console.log("AI Raw Suggestions:", text);
    
    // Improved cleaning for JSON
    const jsonMatch = text.match(/\[.*\]/s);
    const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, "").trim();
    
    return JSON.parse(cleanJson);
  } catch (err: any) {
    console.error("AI Suggestions Error:", err);
    throw new Error(`Erreur AI: ${err.message || "Impossible de générer les suggestions"}`);
  }
}

export interface GeneratedArticle {
  title: string;
  content: string;
  summary: string;
  category: string;
  platforms: string[];
  tags: string[];
  imageUrl?: string;
}

export async function generateArticle(topic: string, imageBase64?: string, imageMime?: string): Promise<GeneratedArticle> {
  const ai = getAI();
  if (!ai) throw new Error("AI Service not configured: Please add GEMINI_API_KEY to your project settings.");

  try {
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    });

    const parts: any[] = [];
    
    if (imageBase64 && imageMime) {
      parts.push({
        inlineData: {
          data: imageBase64.split('base64,')[1] || imageBase64,
          mimeType: imageMime
        }
      });
      parts.push({ text: `ANALYSE CETTE IMAGE et rédige un article journalistique de 600 mots sur : "${topic}".` });
    } else {
      parts.push({ text: `Rédige un article journalistique de 600 mots sur le sujet tendance : "${topic}".` });
    }
    
    parts.push({ text: `
    STRICT INSTRUCTIONS:
    1. Utilise Google Search pour trouver des faits RÉCENTS.
    2. Format Markdown pour le champ "content".
    3. REFORMULE TOUT (Contenu 100% original).
    4. Réponds UNIQUEMENT en JSON: { "title": "...", "content": "...", "summary": "...", "category": "...", "platforms": [], "tags": [] }` 
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      tools: [{ googleSearch: {} } as any],
    });

    const response = await result.response;
    const text = response.text();
    console.log("AI Raw Article:", text);
    
    const jsonMatch = text.match(/\{.*\}/s);
    const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/```json|```/g, "").trim();
    
    return JSON.parse(cleanJson) as GeneratedArticle;
  } catch (err: any) {
    console.error("AI Article Error:", err);
    throw new Error(`Erreur AI: ${err.message || "Impossible de rédiger l'article"}`);
  }
}
