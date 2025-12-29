
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, FactCheckResponse, Verdict, GroundingSource } from "../types";

const factCheckCache = new Map<string, FactCheckResponse>();

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async fetchDailyNews(location: string, language: Language): Promise<FactCheckResponse> {
    const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Check if location is in Gorakhpur district
    const isGorakhpurContext = location.toLowerCase().includes('gorakhpur') || 
                               location.toLowerCase().includes('uruwa') || 
                               location.toLowerCase().includes('gola');

    const prompt = `Provide a comprehensive daily news digest for ${location} STRICTLY for the current date: ${today}. 
    
    ${isGorakhpurContext ? `DISTRICT PROTOCOL ENABLED:
    - This is a GORAKHPUR DISTRICT query. 
    - You MUST focus exclusively on locations within Gorakhpur District.
    - Specifically check for and display updates for GOLA GORAKHPUR.
    - ABSOLUTELY DO NOT include news from any location outside of Gorakhpur District boundaries.` : ''}

    RULES:
    1. ONLY include news, events, or reports that occurred or were published on ${today}.
    2. ABSOLUTELY NO news from yesterday or any previous dates. 
    3. If there is NO specific news found for exactly ${today} in ${location}, strictly state: "आज के लिए ${location} में कोई नई मुख्य खबर नहीं मिली है।"
    4. Format the output in professional Markdown:
       - Heading: # ${location} समाचार - ${today}
       - Use ## for subheadings.
       - Use bullet points for stories.
    5. The language of the response must be ${language}.
    6. Double-check all dates and locations. If a source mentions a location outside ${isGorakhpurContext ? 'Gorakhpur District' : location}, ignore it.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING },
              explanation: { type: Type.STRING },
              sources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    uri: { type: Type.STRING }
                  },
                  required: ["title", "uri"]
                }
              }
            },
            required: ["verdict", "explanation", "sources"]
          }
        },
      });

      const result = JSON.parse(response.text || "{}");
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      
      const extractedSources: GroundingSource[] = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || "News Source",
          uri: chunk.web.uri,
        }));

      return {
        verdict: Verdict.UNKNOWN,
        explanation: result.explanation,
        sources: [...(result.sources || []), ...extractedSources].slice(0, 5),
      };
    } catch (error) {
      console.error("News fetch error:", error);
      return {
        verdict: Verdict.UNKNOWN,
        explanation: "समाचार प्राप्त करने में असमर्थ। कृपया बाद में पुनः प्रयास करें।",
        sources: []
      };
    }
  }

  async factCheck(content: string, imageBase64?: string, language: Language = Language.HINDI): Promise<FactCheckResponse> {
    const cleanContent = content.trim().toLowerCase();
    const cacheKey = `${cleanContent}_${language}`;
    
    if (!imageBase64 && cleanContent.length > 5 && factCheckCache.has(cacheKey)) {
      return factCheckCache.get(cacheKey)!;
    }

    const isGorakhpurQuery = cleanContent.includes('gorakhpur') || 
                             cleanContent.includes('uruwa') || 
                             cleanContent.includes('gola') ||
                             cleanContent.includes('bansgaon') ||
                             cleanContent.includes('khajni');

    const prompt = `Verify the following claim: "${content}" in ${language}.
    
    ${isGorakhpurQuery ? `STRICT DISTRICT FILTERING:
    - This query relates to GORAKHPUR DISTRICT.
    - You MUST prioritize information related to GOLA GORAKHPUR and other Gorakhpur regions.
    - DO NOT include or display information from outside Gorakhpur District.
    - If the user types a location within Gorakhpur, ensure the context stays strictly local to Gorakhpur.` : ''}

    CRITICAL: Provide the explanation in structured Markdown format. 
    - Use **bold** for key facts or names.
    - Use bullet points for verification steps.
    - Keep it very easy to read for a common person.
    - Highlight numbers and dates.

    Return JSON with:
    1. verdict: (Sahi/Galat/Bhramak/Asphasht)
    2. explanation: (Markdown structured text)
    3. sources: Array of objects with title and uri.`;

    try {
      const parts: any[] = [{ text: prompt }];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64.includes('base64,') ? imageBase64.split(',')[1] : imageBase64,
          },
        });
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdict: { type: Type.STRING },
              explanation: { type: Type.STRING },
              sources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    uri: { type: Type.STRING }
                  },
                  required: ["title", "uri"]
                }
              }
            },
            required: ["verdict", "explanation", "sources"]
          }
        },
      });

      const text = response.text || "{}";
      const result = JSON.parse(text);

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const extractedSources: GroundingSource[] = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || "Reference",
          uri: chunk.web.uri,
        }));

      const finalResponse: FactCheckResponse = {
        verdict: result.verdict as Verdict,
        explanation: result.explanation,
        sources: [...(result.sources || []), ...extractedSources].slice(0, 3),
      };

      if (!imageBase64 && cleanContent.length > 5) {
        factCheckCache.set(cacheKey, finalResponse);
      }

      return finalResponse;
    } catch (error: any) {
      console.error("Fact-check error:", error);
      
      let errorCode: 'RATE_LIMIT' | 'NETWORK_ERROR' | 'API_ERROR' | 'UNKNOWN' = 'UNKNOWN';
      let errorMessage = "Unable to verify at this moment.";

      if (!navigator.onLine) {
        errorCode = 'NETWORK_ERROR';
        errorMessage = "Internet connection lost.";
      } else if (error?.message?.includes('429')) {
        errorCode = 'RATE_LIMIT';
        errorMessage = "Service is currently busy. Please wait a moment.";
      } else if (error?.message?.includes('400') || error?.message?.includes('500')) {
        errorCode = 'API_ERROR';
        errorMessage = "Internal system error.";
      }

      return {
        verdict: Verdict.UNKNOWN,
        explanation: errorMessage,
        sources: [],
        error: { code: errorCode, message: errorMessage }
      };
    }
  }

  async generateSpeech(text: string, language: Language): Promise<Uint8Array | null> {
    let voiceName = 'Kore'; 
    if (language === Language.ENGLISH) voiceName = 'Puck';
    if (language === Language.BHOJPURI) voiceName = 'Charon';

    try {
      const cleanText = text.replace(/[*_#]/g, '');
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio ? this.decodeBase64(base64Audio) : null;
    } catch (error) {
      console.error("TTS error:", error);
      return null;
    }
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}

export const geminiService = new GeminiService();
