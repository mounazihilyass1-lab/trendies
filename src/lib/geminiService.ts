import { GoogleGenAI, Type } from "@google/genai";

// Lazy-initialize the API to prevent crashes if the key is missing during build or startup
let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is missing. AI features will be disabled. Check your environment variables.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateSuggestions(): Promise<string[]> {
  const ai = getAI();
  if (!ai) throw new Error("AI Service not configured.");

  const prompt = `Génère une liste de 5 sujets de tendances actuelles sur les réseaux sociaux (TikTok, Twitter, Instagram). 
Utilise Google Search pour trouver des sujets RÉELS et RÉCENTS de moins de 24 heures.
Sujets à privilégier : Pop culture, Tech, Viral trends.
Réponds EXCLUSIVEMENT avec un tableau JSON de chaînes de caractères.`;
  
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING
        }
      }
    }
  });

  try {
    const text = response.text || "[]";
    console.log("Suggestions raw response:", text);
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse suggestions", err);
    return [];
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
  if (!ai) throw new Error("AI Service not configured.");

  const parts: any[] = [];
  
  if (imageBase64 && imageMime) {
    parts.push({
      inlineData: {
        data: imageBase64.split('base64,')[1] || imageBase64,
        mimeType: imageMime
      }
    });
    parts.push({ text: `Analyse cette image et rédige un article journalistique complet et engageant (environ 600 mots) sur ce sujet : "${topic}".` });
  } else {
    parts.push({ text: `Rédige un article journalistique complet et engageant (environ 600 mots) sur le sujet tendance suivant trouvé sur les réseaux sociaux : "${topic}".` });
  }
  
  parts.push({ text: `
1. Utilise IMMÉDIATEMENT Google Search pour trouver des statistiques exactes, des actualités RÉCENTES et des informations pour enrichir dynamiquement le contenu.
2. Le ton doit être moderne, adapté aux réseaux sociaux mais très professionnel.
3. Le contenu (\`content\`) doit être formaté en Markdown.
4. Extrait une courte introduction (\`summary\`).
5. Détermine la catégorie principale (ex: Tech, Mode, Pop Culture, etc.).
6. Liste les plateformes où cette tendance est populaire (ex: ["TikTok", "Twitter"]).
7. Ajoute jusqu'à 5 mots-clés/hashtags pertinents (\`tags\`).

CONTRAINTE LÉGALE STRICTE : Tu dois REFORMULER INTÉGRALEMENT tout le texte. Tu ne dois inclure AUCUN contenu sous droits d'auteur, ni plagier, copie-coller ou imiter directement les sources trouvées. Ton contenu doit être 100% original tout en s'appuyant sur les *faits* trouvés.`
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: { parts },
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Titre de l'article, impactant et clair." },
          content: { type: Type.STRING, description: "Corps de l'article formaté en Markdown." },
          summary: { type: Type.STRING, description: "Un résumé court de l'article." },
          category: { type: Type.STRING, description: "Catégorie principale." },
          platforms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ex: ['TikTok', 'Instagram']" },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tags sous forme de texte simple." }
        },
        required: ["title", "content", "summary", "category", "platforms", "tags"]
      }
    }
  });

  try {
    const text = response.text || "{}";
    console.log("Article raw response:", text);
    const data = JSON.parse(text);
    return data as GeneratedArticle;
  } catch (err) {
    console.error("Failed to generate article", err);
    throw new Error("Erreur de format depuis l'IA.");
  }
}
