/**
 * Ollama integration
 * Query local LLM for text generation
 */

import axios from 'axios';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const MODEL = 'llama3:8b';

export async function queryOllama(prompt, options = {}) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if model is available before querying
      try {
        const status = await getOllamaStatus();
        const hasModel = status.models?.some(m => m.name?.includes(MODEL));
        
        if (!hasModel) {
          throw new Error(`Model ${MODEL} not yet downloaded. Waiting...`);
        }
      } catch (statusError) {
        console.warn(`Model status check: ${statusError.message}`);
      }

      console.log(`🔄 Ollama query attempt ${attempt}/${maxRetries}...`);
      
      const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
        model: MODEL,
        prompt: prompt,
        stream: false,
        temperature: options.temperature || 0.7,
        num_ctx: options.num_ctx || 8192,
      }, {
        timeout: 180000, // 3 min timeout for inference
      });

      if (!response.data.response) {
        throw new Error('Empty response from Ollama');
      }

      return response.data.response;
    } catch (error) {
      lastError = error;
      console.error(`⚠️  Ollama query failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error(`❌ Ollama query failed after ${maxRetries} attempts:`, lastError.message);
  throw new Error(`Ollama inference failed: ${lastError.message}`);
}

export async function getOllamaStatus() {
  try {
    const response = await axios.get(`${OLLAMA_HOST}/api/tags`, {
      timeout: 5000,
    });

    return response.data || { models: [] };
  } catch (error) {
    console.error(`❌ Ollama status check failed:`, error.message);
    throw new Error(`Cannot reach Ollama: ${error.message}`);
  }
}

export async function pullModel(modelName) {
  try {
    const response = await axios.post(`${OLLAMA_HOST}/api/pull`, {
      name: modelName,
      stream: false,
    }, {
      timeout: 3600000, // 1 hour timeout for large models
    });

    return response.data;
  } catch (error) {
    console.error(`❌ Model pull failed:`, error.message);
    throw new Error(`Failed to pull model: ${error.message}`);
  }
}
