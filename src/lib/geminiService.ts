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
  if (!ai) throw new Error("AI Service not configured: Please add GEMINI_API_KEY to your settings.");

  try {
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `Génère une liste de 5 sujets de tendances actuelles MAJEURES sur les réseaux sociaux francophones (TikTok, Twitter, Instagram). 
    Utilise tes outils de recherche pour trouver des événements réels de moins de 24h.
    Retourne uniquement un tableau JSON de chaînes de caractères (ex: ["Sujet 1", "Sujet 2"]).`;
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} } as any],
    });

    const response = await result.response;
    const text = response.text();
    console.log("AI Suggestions Response:", text);
    
    // Clean potential markdown blocks if AI didn't follow JSON only instruction
    const cleanJson = text.replace(/```json|```/g, "").trim();
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
  if (!ai) throw new Error("AI Service not configured: Please add GEMINI_API_KEY to your settings.");

  try {
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const parts: any[] = [];
    
    if (imageBase64 && imageMime) {
      parts.push({
        inlineData: {
          data: imageBase64.split('base64,')[1] || imageBase64,
          mimeType: imageMime
        }
      });
      parts.push({ text: `Analyse cette image et rédige un article journalistique complet sur ce sujet : "${topic}".` });
    } else {
      parts.push({ text: `Rédige un article journalistique complet sur le sujet tendance suivant : "${topic}".` });
    }
    
    parts.push({ text: `
    Instructions Article:
    1. Utilise Google Search pour des faits et actus RÉCENTES.
    2. Format Markdown pour "content".
    3. REFORMULE TOUT (Zéro Plagiat). 
    4. Réponds en JSON suivant ce schéma: { title, content, summary, category, platforms: [], tags: [] }` 
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      tools: [{ googleSearch: {} } as any],
    });

    const response = await result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson) as GeneratedArticle;
  } catch (err: any) {
    console.error("AI Article Error:", err);
    throw new Error(`Erreur AI: ${err.message || "Impossible de rédiger l'article"}`);
  }
}
