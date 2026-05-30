import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

export interface ParsedQuery {
  city: string | null;
  propertyType: 'Flat' | 'Villa' | 'Plot' | 'Commercial' | null;
  bhk: number | null;
  budgetMax: number | null; // in Lakhs
}

const API_KEY = process.env.GEMINI_API_KEY;
const isApiKeyPlaceholder = !API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY' || API_KEY === '';

let aiClient: GoogleGenAI | null = null;
if (!isApiKeyPlaceholder) {
  try {
    aiClient = new GoogleGenAI({ apiKey: API_KEY });
    console.log('[AI] Gemini AI successfully initialized.');
  } catch (error) {
    console.error('[AI Warning] Failed to initialize GoogleGenAI client:', error);
  }
} else {
  console.log('[AI Warning] GEMINI_API_KEY is missing or placeholder. Using fallback heuristic parser.');
}

/**
 * Fallback parser using regex heuristics to parse standard Indian Real Estate queries in English/Hinglish
 */
function heuristicParse(text: string): ParsedQuery {
  const query = text.toLowerCase();
  const result: ParsedQuery = {
    city: null,
    propertyType: null,
    bhk: null,
    budgetMax: null,
  };

  // 1. Detect City with variations (Delhi NCR, Bombay, Bengaluru, BLR)
  if (query.includes('patna')) {
    result.city = 'Patna';
  } else if (query.includes('delhi') || query.includes('ncr')) {
    result.city = 'Delhi';
  } else if (query.includes('mumbai') || query.includes('bombay')) {
    result.city = 'Mumbai';
  } else if (query.includes('bangalore') || query.includes('bengaluru') || query.includes('blr')) {
    result.city = 'Bangalore';
  }

  // 2. Detect Property Type with expanded real estate terminology
  if (query.includes('flat') || query.includes('apartment') || query.includes('bhk') || query.includes('flats') || query.includes('studio') || query.includes('penthouse') || query.includes('room')) {
    result.propertyType = 'Flat';
  } else if (query.includes('villa') || query.includes('house') || query.includes('duplex') || query.includes('bungalow') || query.includes('kothi') || query.includes('rowhouse') || query.includes('farmhouse')) {
    result.propertyType = 'Villa';
  } else if (query.includes('plot') || query.includes('land') || query.includes('zameen') || query.includes('plots') || query.includes('meadow') || query.includes('meadows')) {
    result.propertyType = 'Plot';
  } else if (query.includes('commercial') || query.includes('shop') || query.includes('showroom') || query.includes('office') || query.includes('retail') || query.includes('warehouse')) {
    result.propertyType = 'Commercial';
  }

  // 3. Detect BHK with standard spacing
  const bhkMatch = query.match(/(\d)\s*(?:bhk|bedroom|bed room|b\/h\/k)/i);
  if (bhkMatch) {
    result.bhk = parseInt(bhkMatch[1], 10);
  }

  // 4. Detect Budget supporting decimals (e.g. 85.5 lakhs, 1.2 cr, 75L)
  const lakhMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:lakh|l|lakhs)/i);
  const crMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/i);

  if (crMatch) {
    result.budgetMax = Math.round(parseFloat(crMatch[1]) * 100); // 1.5 Cr -> 150 Lakhs
  } else if (lakhMatch) {
    result.budgetMax = Math.round(parseFloat(lakhMatch[1]));
  }

  return result;
}

/**
 * Uses Gemini AI to parse raw text into structured search criteria.
 * Fallbacks to regex heuristics if Gemini API key is missing or fails.
 */
export async function extractQueryEntities(text: string): Promise<ParsedQuery> {
  if (isApiKeyPlaceholder || !aiClient) {
    console.log('[AI] Running heuristic parser fallback.');
    return heuristicParse(text);
  }

  try {
    const prompt = `
You are an expert NLP parser for a real estate agency in India.
Analyze the user's search query (written in English or Hinglish/transliterated Hindi) and extract search parameters.

User Query: "${text}"

Extract the following variables:
1. "city": Best matching city name. Capitalize the first letter (e.g., "Patna", "Delhi", "Mumbai", "Bangalore"). If none mentioned, output null.
2. "propertyType": Must be one of: "Flat", "Villa", "Plot", "Commercial". If not mentioned, infer it or default to null.
3. "bhk": Number of bedrooms. Extract integer number (e.g. 1, 2, 3, 4). If not mentioned, output null.
4. "budgetMax": Maximum price budget in Indian Rupees **Lakhs** (e.g., 70 Lakhs is 70, 1.2 Crore is 120, 50L is 50). If none mentioned, output null.

Return ONLY a valid JSON object matching this schema. Do not write markdown tags or other explanations.
Example JSON:
{
  "city": "Patna",
  "propertyType": "Flat",
  "bhk": 3,
  "budgetMax": 70
}
`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const cleanText = response.text?.trim() || '{}';
    const parsed = JSON.parse(cleanText) as ParsedQuery;

    // Sanitize propertyType to ensure it conforms to allowed values
    const allowedTypes = ['Flat', 'Villa', 'Plot', 'Commercial'];
    if (parsed.propertyType && !allowedTypes.includes(parsed.propertyType)) {
      parsed.propertyType = null;
    }

    return {
      city: parsed.city || null,
      propertyType: parsed.propertyType || null,
      bhk: parsed.bhk ? Number(parsed.bhk) : null,
      budgetMax: parsed.budgetMax ? Number(parsed.budgetMax) : null,
    };
  } catch (error: any) {
    // Graceful fallback logger: avoids throwing raw HTTP 403/429 stacks to prevent logs cluttering
    const status = error?.status || (error?.message && error.message.includes('403') ? 403 : null);
    if (status === 403 || status === 429) {
      console.log(`[AI Warning] Gemini API is currently unavailable (Quota/Blocked - Status: ${status}). Using local heuristic parser.`);
    } else {
      console.log(`[AI Error] Gemini extraction failed. Using local heuristic parser. Message: ${error?.message || error}`);
    }
    return heuristicParse(text);
  }
}

/**
 * Gets real estate advice and investment analysis from Gemini.
 */
export async function getRealEstateAdvice(question: string): Promise<string> {
  if (isApiKeyPlaceholder || !aiClient) {
    return `[AI Fallback Advice]
Real Estate in Patna and other tier-2 cities is growing rapidly!
- **Danapur & Saguna More**: High residential demand due to close proximity to railway station and schools. ROI is ~8-12% annually.
- **Bihta (IIT Corridor)**: Excellent for commercial plots and long-term land investment (5-10 years horizon) due to the new airport proposal and IIT Patna.
- **Patliputra Colony**: High-end luxury residential flats with high rental yields (~3-4% yield).

*(Configure a valid GEMINI_API_KEY in .env to get detailed, dynamically researched AI answers!)*`;
  }

  try {
    const prompt = `
You are a highly experienced Indian Real Estate Investment Advisor and Market Research Expert.
The user is asking: "${question}"

Provide a detailed, professional, and practical response focusing on:
1. High-potential areas (e.g. Danapur, Bihta, Patliputra in Patna or equivalent prime locations).
2. Expected ROI, rental yield, and growth catalysts (like airports, metros, IIT, industrial corridors).
3. Practical advice for investors or buyers.
Keep the tone helpful, modern, and in easy-to-understand English mixed with standard Hindi/Hinglish terminology if appropriate. Format the response nicely using bold and bullet points. Keep it under 250 words.
`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || 'Sorry, I could not compile the investment advice at the moment. Please try again.';
  } catch (error: any) {
    console.log(`[AI Warning] Gemini advice failed. Using highly optimized local market fallback advisors. Message: ${error?.message || error}`);
    return `🏢 **Aarna Estates Market Advisory** 🏢\n\n` +
      `Danapur, Patliputra, aur Bihta areas me active investments kaafi positive and stable ROI return de rahe hain:\n` +
      `- **Danapur & Saguna More**: Rent value (~3.5% yield) and residential growth are very high. High demand for luxury flats.\n` +
      `- **Bihta Corridor (IIT)**: Best choice for long-term plot & land appreciation (due to new airport proposal and IIT Patna expansion).\n` +
      `- **Patliputra Colony**: High-end premium luxury residential suites.\n\n` +
      `*Aap direct humare real estate consultant se chat karke specific coordinate reports le sakte hain!*`;
  }
}
