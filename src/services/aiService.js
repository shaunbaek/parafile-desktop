const OpenAI = require('openai');
require('dotenv').config();

class AIService {
  constructor() {
    this.openai = null;
    this.initialize();
  }

  initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found. Please set OPENAI_API_KEY in your .env file');
      return;
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async categorizeDocument(text, categories) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const categoryList = categories.map(cat => 
      `- ${cat.name}: ${cat.description}`
    ).join('\n');

    const systemPrompt = `You are a document categorization assistant. Analyze the provided document text and categorize it into one of the given categories.

Available categories:
${categoryList}

Respond with a JSON object containing:
- category: The name of the most appropriate category
- reasoning: A brief explanation of why this category was chosen
- confidence: A number from 0 to 100 indicating your confidence level`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Document text:\n\n${text.substring(0, 4000)}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error categorizing document:', error);
      return {
        category: 'General',
        reasoning: 'Failed to categorize due to API error',
        confidence: 0
      };
    }
  }

  async extractVariable(text, variable) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const systemPrompt = `You are a document information extraction assistant. Extract the value for the specified variable from the document text.

Variable: ${variable.name}
Description: ${variable.description}

Respond with a JSON object containing:
- value: The extracted value (or null if not found)
- confidence: A number from 0 to 100 indicating your confidence level
- context: A brief snippet showing where the value was found`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Document text:\n\n${text.substring(0, 4000)}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 300
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error(`Error extracting variable ${variable.name}:`, error);
      return {
        value: null,
        confidence: 0,
        context: 'Failed to extract due to API error'
      };
    }
  }

  async generateFilename(namingPattern, variables, documentText) {
    const variableValues = {};
    
    const requiredVariables = this.extractVariablesFromPattern(namingPattern);
    
    for (const varName of requiredVariables) {
      if (varName === 'original_name') {
        continue;
      }
      
      const variable = variables.find(v => v.name === varName);
      if (variable) {
        const result = await this.extractVariable(documentText, variable);
        variableValues[varName] = result.value || `<${varName.toUpperCase()}>`;
      } else {
        variableValues[varName] = `<${varName.toUpperCase()}>`;
      }
    }
    
    return this.applyNamingPattern(namingPattern, variableValues);
  }

  extractVariablesFromPattern(pattern) {
    const matches = pattern.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    
    return matches.map(match => match.slice(1, -1));
  }

  applyNamingPattern(pattern, values) {
    let result = pattern;
    
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, this.sanitizeFilename(value));
    }
    
    return result;
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = new AIService();