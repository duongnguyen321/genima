import { GoogleGenAI } from "@google/genai";
import { GenerationResult, ImageState, AppSettings } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Edits an image based on a text prompt using Gemini 2.5 Flash Image.
 * 
 * @param inputs Array of ImageState objects to be sent to the model (Can be empty for generation)
 * @param prompt The text description of the changes
 * @param settings App settings including temperature, aspect ratio, etc.
 */
export const editImageWithGemini = async (
  inputs: ImageState[],
  prompt: string,
  settings: AppSettings
): Promise<GenerationResult> => {
  try {
    // Nano banana maps to 'gemini-2.5-flash-image'
    const modelId = 'gemini-2.5-flash-image';
    
    // Construct parts from images and text
    const parts: any[] = [];
    
    if (inputs && inputs.length > 0) {
        inputs.forEach(img => {
            if (img.base64Data && img.mimeType) {
                parts.push({
                    inlineData: {
                        data: img.base64Data,
                        mimeType: img.mimeType
                    }
                });
            }
        });
    }

    // Augment prompt based on settings
    let finalPrompt = prompt;

    const isEditing = inputs && inputs.length > 0;

    // Inject Style instructions with strict preservation constraints
    if (settings.style && settings.style !== 'None') {
        if (isEditing) {
            finalPrompt += ` Change the art style to ${settings.style}. CRITICAL: You must STRICTLY PRESERVE the original facial features, identity, pose, and structural lines of the subject. Do not alter the face shape or geometry. Only apply the ${settings.style} aesthetic texture and lighting.`;
        } else {
            finalPrompt += ` Create the image in ${settings.style} style.`;
        }
    }

    if (settings.isFullBody) {
      finalPrompt += " Ensure the full body of the subject is visible and not cropped.";
    }

    parts.push({ text: finalPrompt });

    // Determine system instruction based on mode (Editing vs Generation)
    const editingInstruction = "You are an expert image editing AI. Your task is to edit the input image based on the user's prompt.\n\nCRITICAL RULES:\n1. PRESERVE FIDELITY: You must strictly follow the geometry, facial features, architectural details, and composition of the input image. Do not reimagine the subject's identity or key structural elements unless explicitly asked to change them.\n2. CONCISE EXECUTION: Execute the edit directly without adding unrequested elements or hallucinations.\n3. STYLE TRANSFER: If a style is requested, apply the texture and lighting of the style onto the existing geometry. Do not distort faces or objects.";
    
    const generationInstruction = "You are an expert image generation AI. Create a high-quality image based on the user's prompt.";

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: parts,
      },
      config: {
        temperature: settings.temperature,
        systemInstruction: isEditing ? editingInstruction : generationInstruction,
        imageConfig: {
            aspectRatio: settings.aspectRatio as any, // Cast to any to avoid strict enum type issues if SDK versions mismatch
        }
      }
    });

    let generatedImageUrl: string | null = null;
    let generatedText: string | null = null;

    // Safe navigation using optional chaining (?.) to prevent crashes if candidates or content is missing
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64String = part.inlineData.data;
          // Ensure we construct a valid data URL
          generatedImageUrl = `data:image/png;base64,${base64String}`;
        } else if (part.text) {
          generatedText = part.text;
        }
      }
    }

    return {
      imageUrl: generatedImageUrl,
      text: generatedText,
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Enhances a user's prompt for image editing using Gemini 2.5 Flash.
 */
export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Rewrite the following image editing prompt to be more descriptive but CONCISE and precise for an AI image generator. Do not be verbose. Return ONLY the enhanced prompt, no explanations. 
      
      Original Prompt: "${originalPrompt}"`,
    });

    return response.text?.trim() || originalPrompt;
  } catch (error) {
    console.error("Prompt Enhance Error:", error);
    return originalPrompt; // Fallback to original
  }
};