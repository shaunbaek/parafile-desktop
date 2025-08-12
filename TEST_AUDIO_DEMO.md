# 🎵 Audio Processing Feature - Demo Instructions

ParaFile now supports **audio file processing** using OpenAI's Whisper API! This allows you to automatically transcribe and organize audio files like meeting recordings, interviews, podcasts, and more.

## ✅ What's Been Implemented

### **1. Audio Transcription Service** (`audioTranscriber.js`)
- **OpenAI Whisper Integration**: Uses `whisper-1` model for high-quality transcription
- **Format Support**: `.mp3`, `.mp4`, `.mpeg`, `.mpga`, `.m4a`, `.wav`, `.webm`
- **File Size Limit**: 25MB per audio file (OpenAI limitation)
- **Language Detection**: Automatic language detection and metadata
- **Cost Estimation**: Built-in cost calculator for budget planning

### **2. Text Extraction Integration**
- **Seamless Integration**: Audio files work just like PDFs and Word docs
- **Rich Metadata**: Includes language, duration, and timestamp information
- **Error Handling**: Graceful fallbacks and helpful error messages

### **3. Document Processing Pipeline**
- **AI Analysis**: Transcribed text is analyzed by GPT-4 for categorization
- **Smart Naming**: Uses audio content to generate meaningful filenames
- **Category Detection**: Automatically categorizes based on audio content

### **4. File Monitoring**
- **Real-time Detection**: Monitors for new audio files in watched folders
- **Format Recognition**: Automatically detects supported audio formats
- **Background Processing**: Transcribes and organizes audio files automatically

## 🎯 Test Files Created

Located in `test-files/audio/`:
- **Meeting_Budget_Planning_Q4.wav** - Sample meeting recording
- **Interview_John_Smith_Marketing.wav** - Sample interview
- **Sales_Review_October_2024.wav** - Sample sales call

## 🧪 How to Test

### **Option 1: Run Test Scripts**
```bash
# Test core audio functionality
node test-audio-processing.js

# Run unit tests
npm test tests/unit/audioTranscriber.test.js
```

### **Option 2: Test in ParaFile App**
1. **Start ParaFile**: `npm start`
2. **Configure Settings**:
   - Set OpenAI API key in Settings
   - Choose a watched folder
   - Start monitoring
3. **Test Audio Processing**:
   - Copy a test audio file to the watched folder
   - Watch ParaFile automatically transcribe and organize it

### **Option 3: Manual Test**
```bash
# Copy test file to your watched folder
cp test-files/audio/Meeting_Budget_Planning_Q4.wav /path/to/your/watched/folder/
```

## 📊 Expected Results

When you process the test audio files, you should see:

1. **Transcription**: 
   ```
   "This is a test recording for the ParaFile audio processing system. 
   This audio file contains a sample meeting recording about quarterly budget planning."
   ```

2. **AI Categorization**: Should be categorized as "Meeting Recordings" or similar

3. **Smart Naming**: Filename like `Meeting_Budget_Planning_Q4_2024.wav`

4. **Metadata**: 
   - Language: English
   - Duration: ~8 seconds
   - Processing time: ~3-4 seconds

## 🔧 Configuration

### **Audio Categories (Suggested)**
Add these categories to optimize audio file organization:

```json
{
  "name": "Meeting Recordings",
  "description": "Audio recordings of business meetings, calls, and discussions",
  "naming_pattern": "{type}_{date}_{topic}"
},
{
  "name": "Interviews",
  "description": "Interview recordings with employees, candidates, or clients", 
  "naming_pattern": "Interview_{participant}_{date}"
},
{
  "name": "Podcasts",
  "description": "Podcast recordings and audio content",
  "naming_pattern": "Podcast_{topic}_{date}"
}
```

### **Audio Variables (Suggested)**
```json
{
  "name": "speaker",
  "description": "Main speaker or participant in the audio"
},
{
  "name": "topic", 
  "description": "Main topic or subject discussed"
},
{
  "name": "meeting_type",
  "description": "Type of meeting (standup, review, planning, etc.)"
}
```

## 🚀 Performance

- **Transcription Speed**: ~3-4 seconds for short audio files
- **Accuracy**: High accuracy using OpenAI Whisper-1 model
- **Cost**: ~$0.006 per minute of audio (OpenAI pricing)
- **File Size**: Up to 25MB per file

## 🔍 Troubleshooting

### **Common Issues:**
1. **"API key not configured"** → Add OpenAI API key in Settings
2. **"File too large"** → Audio files must be ≤25MB
3. **"Unsupported format"** → Use supported formats: mp3, wav, m4a, etc.
4. **Slow processing** → Normal for longer audio files

### **Debug Commands:**
```bash
# Check audio file details
file test-files/audio/Meeting_Budget_Planning_Q4.wav

# Test audio transcription directly
node -e "
const AudioTranscriber = require('./src/services/audioTranscriber');
const transcriber = new AudioTranscriber();
transcriber.initialize(process.env.OPENAI_API_KEY);
transcriber.transcribeAudio('./test-files/audio/Meeting_Budget_Planning_Q4.wav')
  .then(result => console.log(JSON.stringify(result, null, 2)));
"
```

## 🎉 Success Indicators

You'll know audio processing is working when you see:

1. ✅ **Tray menu shows audio files** in recent processing
2. ✅ **Console logs** show "Audio transcription completed"
3. ✅ **Files are moved** to appropriate category folders
4. ✅ **Smart naming** based on audio content
5. ✅ **Processing log** shows transcription details

---

**🚀 ParaFile now supports audio files! Drop audio recordings into your watched folder and watch the magic happen!** 🎵✨