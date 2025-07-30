const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = null;
  }

  initialize(apiKey) {
    if (!apiKey) {
      console.warn('OpenAI API key not provided');
      this.openai = null;
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

  async generateVariableSuggestion(userPrompt) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const systemPrompt = `You are a helpful assistant that generates variable names and descriptions for a document processing system. 
Based on the user's description of what information they want to extract from documents, generate:
1. A concise, descriptive variable name (lowercase, using underscores for spaces)
2. A clear description that explains what the AI should extract from documents

The variable name should be machine-friendly (e.g., invoice_date, client_name, total_amount).
The description should be specific and clear for the AI to understand what to extract.

Respond with a JSON object containing:
- name: The variable name (lowercase with underscores)
- description: A clear description of what to extract`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error generating variable suggestion:', error);
      throw error;
    }
  }
}

module.exports = new AIService();