import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const findEmailsForUrl = async (url: string, targetAudience?: string): Promise<string[]> => {
  try {
    const ai = getClient();
    
    // We use googleSearch to ground the result in reality.
    // Note: When using googleSearch, we cannot use responseSchema.
    // We must rely on the model to format the text output as JSON.
    
    let instructions = `
      I need to find public contact email addresses for the following website/company: ${url}.
      
      Use Google Search to find their "Contact Us", "About", "Team", "Management" or "Support" pages.
    `;

    if (targetAudience && targetAudience.trim() !== '') {
      instructions += `
      
      MY GOAL / TARGET AUDIENCE IS: "${targetAudience}"
      
      PRIORITY INSTRUCTIONS:
      1. First, try to find specific personal emails for people matching the target audience (e.g. CEO, Founder, VP Marketing, etc).
      2. If you find these high-value emails, list them first.
      3. CRITICAL: If you CANNOT find emails for specific roles (CEOs, etc.), you MUST fallback and return the best available general emails (info@, contact@, hello@, support@).
      4. Do not return an empty list just because you couldn't find the CEO. Any email is better than no email.
      `;
    } else {
      instructions += `
      Look for patterns like info@, support@, contact@, or specific employee emails if publicly listed.
      `;
    }

    instructions += `
      
      Output Rules:
      1. Return ONLY a valid JSON object.
      2. The JSON object must have a single key "emails" which is an array of strings.
      3. If no emails are found, return { "emails": [] }.
      4. Do not include Markdown formatting (like \`\`\`json). Just the raw JSON string.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: instructions,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0, // Low temperature for deterministic output
      }
    });

    const text = response.text || '';
    
    // Clean up potential markdown code blocks if the model ignores the instruction
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(cleanText);
      if (parsed && Array.isArray(parsed.emails)) {
        // Simple regex to validate emails and remove garbage
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        return parsed.emails.filter((e: string) => emailRegex.test(e));
      }
      return [];
    } catch (e) {
      console.warn("Failed to parse JSON from Gemini response for URL:", url, text);
      return [];
    }

  } catch (error) {
    console.error("Gemini API Error for URL:", url, error);
    throw error;
  }
};