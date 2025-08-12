const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const ModelSelector = require('./modelSelector');

class AIService {
  constructor() {
    this.openai = null;
    this.modelSelector = new ModelSelector();
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

  /**
   * Helper method to select appropriate model for AI tasks
   * @param {Object} options - Task options
   * @returns {Promise<Object>} Model selection result
   */
  async selectModelForTask(options) {
    const {
      task = 'General AI task',
      complexity = 'medium',
      expertise = 'general',
      textLength = 1000,
      requiresSearch = false,
      requiresVision = false
    } = options;

    const modelSelection = await this.modelSelector.selectModel({
      task,
      inputType: requiresVision ? 'image' : 'analysis_task',
      contentLength: textLength > 2000 ? 'long' : textLength > 500 ? 'medium' : 'short',
      complexity: expertise === 'legal' || complexity === 'high' ? 'high' : 'low',
      highAccuracy: expertise === 'legal' || complexity === 'high',
      costSensitive: true,
      needsSearch: requiresSearch,
      needsVision: requiresVision
    });

    console.log(`AI task using ${modelSelection.selectedModel}: ${modelSelection.reasoning}`);
    return modelSelection.selectedModel;
  }

  async categorizeDocument(text, categories, expertise = 'general', feedback = null) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const categoryList = categories.map(cat => 
      `- ${cat.name}: ${cat.description}`
    ).join('\n');

    const expertiseContext = expertise === 'legal' 
      ? `You are a legal document categorization expert. Focus on legal terminology, document types, and legal document structures.`
      : `You are a general document categorization assistant. Focus on common business and personal document types.`;

    // Include feedback learning if available
    let feedbackContext = '';
    if (feedback && feedback.recentCorrections && feedback.recentCorrections.categories.length > 0) {
      feedbackContext = `\n\nIMPORTANT LEARNING FROM USER CORRECTIONS:
Recent categorization corrections made by users:
${feedback.recentCorrections.categories.map(c => 
  `- Documents categorized as "${c.was}" were corrected to "${c.correctedTo}" because: ${c.because}`
).join('\n')}`;
    }

    if (feedback && feedback.categoryPatterns && feedback.categoryPatterns.length > 0) {
      feedbackContext += `\n\nCOMMON PATTERNS:
${feedback.categoryPatterns.map(p => 
  `- Documents initially categorized as "${p.from}" are often corrected to "${p.to}" (${p.occurrences} times)`
).join('\n')}`;
    }
    
    const systemPrompt = `${expertiseContext} Analyze the provided document text and categorize it into one of the given categories.

Available categories:
${categoryList}${feedbackContext}

Respond with a JSON object containing:
- category: The name of the most appropriate category
- reasoning: A detailed explanation of why this category was chosen (2-3 sentences explaining the key indicators and document characteristics that led to this categorization)
- confidence: A number from 0 to 100 indicating your confidence level
- consideringFeedback: Boolean indicating if past corrections influenced this decision`;

    try {
      // Use intelligent model selection for document categorization
      const modelSelection = await this.modelSelector.selectModel({
        task: `Categorize document into one of ${categories.length} categories`,
        inputType: 'analysis_task',
        contentLength: text.length > 2000 ? 'medium' : 'short',
        complexity: expertise === 'legal' ? 'high' : 'low',
        highAccuracy: expertise === 'legal',
        costSensitive: true
      });

      const selectedModel = modelSelection.selectedModel;
      console.log(`Document categorization using ${selectedModel}: ${modelSelection.reasoning}`);

      const response = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Document text:\n\n${text.substring(0, 4000)}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Add token usage information
      if (response.usage) {
        result.tokenUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          estimatedCost: this.calculateCost(response.usage, selectedModel)
        };
      }
      
      // Adjust confidence based on feedback patterns
      if (feedback && feedback.categoryPatterns) {
        const hasPattern = feedback.categoryPatterns.find(p => p.from === result.category);
        if (hasPattern && hasPattern.occurrences >= 3) {
          // Lower confidence if this category is often corrected
          result.confidence = Math.max(result.confidence - 20, 30);
          result.reasoning += ` (Note: This category is often corrected to "${hasPattern.to}")`;
        }
      }
      
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

  async extractVariable(text, variable, feedback = null) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Include variable-specific feedback learning
    let feedbackContext = '';
    if (feedback && feedback.variablePatterns && feedback.variablePatterns[variable.name]) {
      const varPattern = feedback.variablePatterns[variable.name];
      
      if (varPattern.commonMistakes.length > 0) {
        feedbackContext += `\n\nIMPORTANT LEARNING FROM USER CORRECTIONS FOR "${variable.name}":
Common mistakes to avoid:
${varPattern.commonMistakes.map(m => 
  `- DON'T extract "${m.pattern.split('_to_')[0]}" when it should be "${m.pattern.split('_to_')[1]}" (corrected ${m.count} times)
    Reasons: ${m.reasons.join(', ')}`
).join('\n')}`;
      }

      if (varPattern.successfulPatterns.length > 0) {
        feedbackContext += `\n\nSuccessful extraction patterns:
${varPattern.successfulPatterns.map(p => 
  `- In ${p.documentType} documents, look for: "${p.context}" → "${p.correctValue}"`
).join('\n')}`;
      }
    }

    // Add echo prevention data
    if (feedback && feedback.echoPreventionData && feedback.echoPreventionData.similarDocuments.length > 0) {
      feedbackContext += `\n\nSIMILAR DOCUMENTS CONTEXT (to maintain consistency):`;
      feedback.echoPreventionData.similarDocuments.forEach(doc => {
        if (doc.commonPatterns[variable.name]) {
          const pattern = doc.commonPatterns[variable.name];
          feedbackContext += `\n- Similar document had "${variable.name}" corrected from "${pattern.originalValue}" to "${pattern.correctedValue}"`;
          feedbackContext += `\n  Reason: ${pattern.correctionReason}`;
        }
      });
    }

    const systemPrompt = `You are a document information extraction assistant. Extract the value for the specified variable from the document text.

Variable: ${variable.name}
Description: ${variable.description}${feedbackContext}

Respond with a JSON object containing:
- value: The extracted value (or null if not found)
- confidence: A number from 0 to 100 indicating your confidence level
- context: A brief snippet showing where the value was found
- consideringFeedback: Boolean indicating if past corrections influenced this extraction`;

    try {
      // Use intelligent model selection for variable extraction
      const modelSelection = await this.modelSelector.selectModel({
        task: `Extract variable "${variable.name}" from document`,
        inputType: 'analysis_task',
        contentLength: text.length > 2000 ? 'medium' : 'short',
        complexity: 'low', // Variable extraction is usually straightforward
        costSensitive: true
      });

      const selectedModel = modelSelection.selectedModel;
      console.log(`Variable extraction using ${selectedModel}: ${modelSelection.reasoning}`);

      const response = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Document text:\n\n${text.substring(0, 4000)}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 300
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Add token usage information
      if (response.usage) {
        result.tokenUsage = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          estimatedCost: this.calculateCost(response.usage, selectedModel)
        };
      }
      
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

  async generateFilename(namingPattern, variables, documentText, feedback = null) {
    const variableValues = {};
    
    const requiredVariables = this.extractVariablesFromPattern(namingPattern);
    
    for (const varName of requiredVariables) {
      if (varName === 'original_name') {
        continue;
      }
      
      const variable = variables.find(v => v.name === varName);
      if (variable) {
        const result = await this.extractVariable(documentText, variable, feedback);
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

  async generateVariableSuggestion(userPrompt, expertise = 'general') {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const expertiseContext = expertise === 'legal' 
      ? `You are a legal document processing expert. Focus on legal terminology, document types, and legal document structures when generating suggestions. Consider common legal document patterns like contracts, leases, court filings, corporate documents, etc.`
      : `You are a general document processing assistant. Focus on common business and personal document types.`;

    const systemPrompt = `${expertiseContext}

Generate variable names and descriptions for a document processing system based on the user's description of what information they want to extract from documents:

1. A concise, descriptive variable name (lowercase, using underscores for spaces)
2. A clear description that explains what the AI should extract from documents

The variable name should be machine-friendly (e.g., invoice_date, client_name, total_amount).
The description should be specific and clear for the AI to understand what to extract.

Respond with a JSON object containing:
- name: The variable name (lowercase with underscores)
- description: A clear, detailed description of what to extract`;

    try {
      const response = await this.openai.chat.completions.create({
        model: selectedModel,
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

  async generateCategorySuggestion(userPrompt, expertise = 'general') {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const expertiseContext = expertise === 'legal' 
      ? `You are a legal document categorization expert. Focus on legal terminology, document types, and legal document structures when generating suggestions. Consider common legal document categories like contracts, leases, court filings, corporate documents, etc.`
      : `You are a general document categorization assistant. Focus on common business and personal document types.`;

    const systemPrompt = `${expertiseContext}

Generate a category name and description for a document processing system based on the user's description of what types of documents they want to categorize:

1. A concise, descriptive category name (title case, e.g., "Financial Records", "Legal Contracts")
2. A clear description that explains what documents belong in this category for AI categorization

The category name should be user-friendly and descriptive.
The description should be specific and clear for the AI to understand what documents to categorize into this category.

Respond with a JSON object containing:
- name: The category name (title case)
- description: A clear, detailed description of what documents belong in this category`;

    try {
      const response = await this.openai.chat.completions.create({
        model: selectedModel,
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
      console.error('Error generating category suggestion:', error);
      throw error;
    }
  }

  async generatePattern(data, expertise = 'general') {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const { prompt, categoryName, categoryDescription, variables } = data;
    
    const expertiseContext = expertise === 'legal' 
      ? `You are a legal document naming expert. Create patterns suitable for legal document organization.`
      : `You are a document naming expert. Create patterns suitable for general business document organization.`;

    const availableVars = variables.map(v => `{${v.name}} - ${v.description}`).join('\n');

    const systemPrompt = `${expertiseContext}

Given a user's description of how they want to name files in a category, create a naming pattern using available variables.

Category: ${categoryName}
Category Description: ${categoryDescription}

Available variables:
${availableVars}

IMPORTANT RULES:
1. Use ONLY the available variables listed above
2. Variables must be wrapped in curly braces: {variable_name}
3. Use underscores (_) or hyphens (-) between variables
4. Keep patterns concise but informative
5. Order variables logically (e.g., date first, then type, then name)
6. Do NOT create new variables that aren't in the list

Example patterns:
- {date}_{invoice_number}_{vendor}
- {contract_type}_{client_name}_{date}
- {report_type}_{period}_{department}

Respond with a JSON object containing:
- pattern: The naming pattern using available variables
- example: A realistic example of what a filename might look like using this pattern`;

    try {
      const response = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User request: ${prompt}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        success: true,
        pattern: result.pattern,
        example: result.example
      };
    } catch (error) {
      console.error('Error generating pattern:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async searchFiles(data, expertise = 'general') {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const { query, fileList } = data;
    
    const expertiseContext = expertise === 'legal' 
      ? `You are a legal document search expert. Focus on legal terminology, document types, and legal relationships.`
      : `You are a document search expert. Focus on understanding user intent and document content.`;

    // Convert file list to searchable text
    const fileDescriptions = fileList.map(file => 
      `${file.filename} (${file.path}): ${file.content || 'No content preview'}`
    ).join('\n\n');

    const systemPrompt = `${expertiseContext}

You are helping users find files using natural language queries. Given a user's search query and a list of files with their content, identify the most relevant files.

IMPORTANT: Only return files that actually exist in the provided list. Do not make up or suggest files that aren't listed.

User query: "${query}"

Available files:
${fileDescriptions}

Analyze the query and find files that match based on:
1. Content relevance (what the file contains)
2. Filename relevance 
3. Conceptual matches (e.g., "invoice" matches "bill" or "payment")
4. Date/time references if mentioned
5. Company/person names if mentioned

Respond with a JSON object containing an array of the most relevant files, ordered by relevance (best first). Include up to 10 results.

Format:
{
  "results": [
    {
      "filename": "exact filename from list",
      "path": "exact path from list", 
      "relevanceScore": 0.95,
      "reason": "Brief explanation why this file matches the query"
    }
  ]
}

If no files match, return: {"results": []}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Ensure we always return an array
      let results = [];
      if (result.results && Array.isArray(result.results)) {
        results = result.results;
      } else if (Array.isArray(result)) {
        results = result;
      } else if (result && typeof result === 'object') {
        // If it's an object but not what we expect, try to extract any array property
        const arrayKeys = Object.keys(result).find(key => Array.isArray(result[key]));
        if (arrayKeys) {
          results = result[arrayKeys];
        }
      }
      
      // Map relevanceScore to score for frontend consistency
      const mappedResults = results.map(result => ({
        ...result,
        score: result.relevanceScore || result.score || 0
      }));
      
      return {
        success: true,
        results: mappedResults
      };
    } catch (error) {
      console.error('Error searching files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateShortDescription(variableName, description, expertise = 'general') {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const expertiseContext = expertise === 'legal' 
      ? `You are a legal document processing expert. Use appropriate legal terminology in your short descriptions.`
      : `You are a general document processing assistant.`;

    const examples = expertise === 'legal'
      ? `Examples:
- Variable: contract_date, Description: "The effective date of the contract..." → Short: "Contract effective date"
- Variable: party_name, Description: "The legal name of the first party..." → Short: "First party name"
- Variable: case_number, Description: "The court case number found in the header..." → Short: "Court case number"
- Variable: lease_term, Description: "The duration of the lease agreement..." → Short: "Lease term duration"`
      : `Examples:
- Variable: invoice_date, Description: "The date when the invoice was issued..." → Short: "Invoice issue date"
- Variable: client_name, Description: "The full legal name of the client company..." → Short: "Client company name"
- Variable: total_amount, Description: "The total payment amount including taxes..." → Short: "Total payment amount"
- Variable: document_type, Description: "The type of document being processed..." → Short: "Document type"`;

    const systemPrompt = `${expertiseContext} Given a variable name and its detailed description, generate a brief 3-5 word phrase that captures what this variable represents.

${examples}

Respond with a JSON object containing:
- shortDescription: A brief 3-5 word phrase (no periods, capitalize first word only)`;

    try {
      const response = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Variable name: ${variableName}\nDescription: ${description}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 50
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.shortDescription;
    } catch (error) {
      console.error('Error generating short description:', error);
      // Fallback to a simple extraction from the variable name
      return variableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  async evaluateVariableDescription(variableName, description, expertise = 'general') {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const expertiseContext = expertise === 'legal' 
      ? `You are an expert at evaluating variable descriptions for a document processing AI system, with specialized knowledge of legal documents.`
      : `You are an expert at evaluating variable descriptions for a document processing AI system, focused on general business and personal documents.`;

    const expertiseGuidelines = expertise === 'legal'
      ? `For LEGAL DOCUMENTS specifically, ensure descriptions address:
- Common legal terminology variations (e.g., "Effective Date" vs "Commencement Date" vs "As of")
- Document structure patterns (e.g., "typically found in the preamble" or "usually in section headers")
- Party identification (e.g., "first party/second party", "plaintiff/defendant", "lessor/lessee")
- Legal formatting conventions (e.g., "amounts often written in both numbers and words")
- Signature blocks and execution details (e.g., "found near signature lines", "in the attestation clause")
- Common legal document types and their unique patterns:
  * Contracts: parties section, recitals, terms, signature blocks
  * Leases: premises description, term, rent amount
  * Court documents: case numbers, filing dates, docket numbers
  * Corporate documents: entity names, registration numbers, authorized signatories
- Jurisdictional variations (e.g., "state-specific format", "follows federal guidelines")
- Legal date formats (e.g., "the ___ day of ___, 20__")
- Reference handling (e.g., "may reference exhibits", "defined terms in quotes or capitals")`
      : `For GENERAL DOCUMENTS, ensure descriptions address:
- Common business document patterns (invoices, receipts, reports, letters)
- Standard formatting conventions for different document types
- Typical locations of information (headers, footers, specific sections)
- Date and number formats commonly used in business documents
- Contact information patterns (names, addresses, phone numbers, emails)
- Financial information formats (currency, percentages, totals)`;

    const systemPrompt = `${expertiseContext}
Your task is to evaluate if the given description provides enough specific information for an AI to reliably extract the correct data from documents.

Variable name: ${variableName}
Current description: ${description}

Evaluate the description and respond with a JSON object containing:
- isAdequate: boolean (true if the description is specific enough, false if it needs improvement)
- issues: array of strings describing any problems (empty if adequate)
- suggestedDescription: improved description (only if isAdequate is false, otherwise null)
- reasoning: brief explanation of your evaluation

Good descriptions should:
- Be specific about what to look for
- Include format expectations if relevant (e.g., date format, number format)
- Mention context clues or document sections where the information is typically found
- Avoid ambiguity about what constitutes the correct value

${expertiseGuidelines}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Evaluate this variable description:\nVariable: ${variableName}\nDescription: ${description}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 400
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error evaluating variable description:', error);
      throw error;
    }
  }

  async analyzeImageWithVision(imagePath, categories, expertise = 'general') {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      // Read image and convert to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(imagePath);

      const categoryList = categories.map(cat => 
        `- ${cat.name}: ${cat.description}`
      ).join('\n');

      const expertiseContext = expertise === 'legal' 
        ? `You are a legal document categorization expert. Focus on legal terminology, document types, and legal document structures.`
        : `You are a general document categorization assistant. Focus on common business and personal document types.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: expertiseContext
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and categorize it. If it contains text, extract the key information. 
                      
                      Available categories:
                      ${categoryList}
                      
                      Also extract relevant information that might be useful for filename generation (dates, names, amounts, document types, etc.)
                      
                      Respond in JSON format:
                      {
                        "category": "chosen category name",
                        "confidence": 0.0 to 1.0,
                        "reasoning": "explanation of why this category was chosen",
                        "extractedText": "any visible text in the image",
                        "extractedInfo": {
                          "documentType": "type of document if identifiable",
                          "date": "any date found",
                          "entities": ["list of names, companies, etc."],
                          "amounts": ["any monetary amounts"],
                          "other": "any other relevant information"
                        }
                      }`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      // Parse the response
      const content = response.choices[0].message.content;
      
      // Try to extract JSON from the response
      let result;
      try {
        // First try direct JSON parse
        result = JSON.parse(content);
      } catch (e) {
        // If that fails, try to extract JSON from markdown code block
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[1]);
        } else {
          // Fallback: create a basic result from the text
          result = {
            category: 'General',
            confidence: 0.5,
            reasoning: 'Could not parse AI response properly',
            extractedText: content,
            extractedInfo: {}
          };
        }
      }

      return result;
    } catch (error) {
      console.error('Error analyzing image with Vision API:', error);
      
      // Fallback to basic categorization
      return {
        category: 'General',
        confidence: 0.3,
        reasoning: 'Vision API analysis failed, using fallback',
        extractedText: '',
        extractedInfo: {}
      };
    }
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Calculate estimated cost for OpenAI API usage
   * @param {Object} usage - Token usage from OpenAI response
   * @param {string} model - Model name
   * @returns {number} Estimated cost in USD
   */
  calculateCost(usage, model) {
    // OpenAI pricing as of 2025 (per 1K tokens)
    const pricing = {
      // Current models
      'gpt-4o': {
        input: 2.50,    // $2.50 per 1K input tokens
        output: 10.00   // $10.00 per 1K output tokens
      },
      'gpt-4o-mini': {
        input: 0.15,    // $0.15 per 1K input tokens
        output: 0.60    // $0.60 per 1K output tokens
      },
      'gpt-4o-search-preview': {
        input: 2.50,
        output: 10.00
      },
      'gpt-4o-mini-search-preview': {
        input: 0.15,
        output: 0.60
      },
      'gpt-4o-realtime': {
        input: 5.00,
        output: 20.00
      },
      'gpt-4o-mini-realtime': {
        input: 1.00,
        output: 4.00
      },
      // Legacy models for backward compatibility
      'gpt-4-turbo-preview': {
        input: 0.01,
        output: 0.03
      },
      'gpt-4-vision-preview': {
        input: 0.01,
        output: 0.03
      },
      'whisper-1': {
        audio: 0.006    // $0.006 per minute
      }
    };

    if (!pricing[model]) {
      return 0;
    }

    if (model === 'whisper-1') {
      // For Whisper, usage might be in minutes
      return usage.minutes ? usage.minutes * pricing[model].audio : 0;
    }

    const inputCost = (usage.prompt_tokens / 1000) * pricing[model].input;
    const outputCost = (usage.completion_tokens / 1000) * pricing[model].output;
    
    return inputCost + outputCost;
  }
}

module.exports = new AIService();