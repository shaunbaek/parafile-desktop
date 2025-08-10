require('dotenv').config();
const aiService = require('./src/services/aiService');
const textExtractor = require('./src/services/textExtractor');
const path = require('path');

async function testImageProcessing() {
  console.log('Testing image processing with updated Vision API...\n');
  
  // Initialize AI service
  aiService.initialize(process.env.OPENAI_API_KEY);
  
  const imagePath = path.join(__dirname, 'test-files', 'Receipt_Store_20241215.png');
  
  try {
    // Extract text from image
    console.log('1. Extracting text from image...');
    const extracted = await textExtractor.extractImage(imagePath);
    console.log('   OCR Text:', extracted.text.substring(0, 100) + '...');
    console.log('   Metadata:', extracted.metadata);
    
    // Test Vision API
    console.log('\n2. Testing Vision API analysis...');
    const visionResult = await aiService.analyzeImageWithVision(imagePath, {
      categories: [
        { name: 'Receipt', description: 'Purchase receipts' },
        { name: 'General', description: 'Other documents' }
      ],
      variables: [
        { name: 'vendor', description: 'Store or vendor name' },
        { name: 'amount', description: 'Total amount' }
      ]
    });
    
    console.log('   Vision API Result:', visionResult);
    console.log('\n✅ Image processing test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.status === 404) {
      console.error('   Model not found - Vision API model needs update');
    }
  }
  
  process.exit(0);
}

testImageProcessing();