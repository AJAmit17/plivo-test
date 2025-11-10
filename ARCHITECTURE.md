# Plivo & Deepgram Integration - Three-Layer Architecture

This document describes the **complete three-layer architecture** for Plivo Voice API and Deepgram STT API integration with full resilience patterns.

## 🏗️ Architecture Overview

The implementation follows a **three-layer architecture** pattern:

```
┌─────────────────────────────────────────┐
│     API Routes (Next.js)                │
│  - Call initiation endpoint             │
│  - Recording callback webhook           │
│  - Call details retrieval               │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  RESILIENCE LAYER                       │
│  - Circuit Breaker (opossum)            │
│  - Retry with Exponential Backoff       │
│  - Error Handling & Recovery            │
│  - Monitoring & Logging                 │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  MANAGER LAYER                          │
│  - Business Logic                       │
│  - Configuration Management             │
│  - XML Generation (Plivo)               │
│  - Result Processing (Deepgram)         │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│  SERVICE LAYER                          │
│  - Direct API Communication             │
│  - REST Operations                      │
│  - Request/Response Handling            │
│  - Type Safety (DTOs)                   │
└─────────────────────────────────────────┘
```

## 📁 File Structure

```
src/
├── lib/
│   ├── types/
│   │   ├── plivo.types.ts          # Plivo DTOs & interfaces
│   │   └── deepgram.types.ts       # Deepgram DTOs & interfaces
│   │
│   ├── services/
│   │   ├── plivo-service.ts        # Plivo direct API calls
│   │   └── deepgram-service.ts     # Deepgram direct API calls
│   │
│   ├── managers/
│   │   ├── plivo-manager.ts        # Plivo business logic
│   │   └── deepgram-manager.ts     # Deepgram business logic
│   │
│   ├── resilience/
│   │   ├── plivo-resilient.ts      # Plivo resilience layer
│   │   └── deepgram-resilient.ts   # Deepgram resilience layer
│   │
│   └── clients.ts                  # Factory functions for clients
│
└── app/
    └── api/
        ├── calls/
        │   ├── initiate/
        │   │   └── route.ts        # POST /api/calls/initiate
        │   └── details/
        │       └── [callUuid]/
        │           └── route.ts    # GET /api/calls/details/:callUuid
        └── plivo/
            ├── answer/
            │   └── route.ts        # POST /api/plivo/answer
            └── recording-callback/
                └── route.ts        # POST /api/plivo/recording-callback
```

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Plivo Credentials
PLIVO_AUTH_ID=your_auth_id
PLIVO_AUTH_TOKEN=your_auth_token
PLIVO_PHONE_NUMBER=+1234567890

# Deepgram API Key
DEEPGRAM_API_KEY=your_deepgram_api_key

# Application URL (for webhooks)
APP_BASE_URL=https://your-domain.com

# Supabase (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_key
```

## 📊 Layer Breakdown

### 1️⃣ Service Layer

**Purpose**: Direct API communication with minimal abstraction

**Plivo Service** (`plivo-service.ts`):
- `makeCall()` - Initiate outbound calls
- `getCallDetails()` - Retrieve call information
- `getCalls()` - List calls with filters
- `terminateCall()` - End active calls
- `updateCall()` - Transfer or modify calls

**Deepgram Service** (`deepgram-service.ts`):
- `transcribeFromUrl()` - Transcribe audio from URL
- `transcribeFromUrlSimplified()` - Get simplified result
- `transcribeBuffer()` - Transcribe audio buffer
- `validateApiKey()` - Check credentials

### 2️⃣ Manager Layer

**Purpose**: Business logic and configuration management

**Plivo Manager** (`plivo-manager.ts`):
- `initiateRecordedCall()` - Simplified call initiation with recording
- `generateRecordingXML()` - Create Plivo XML responses
- `generateSpeakXML()` - Generate speak instructions
- `waitForRecording()` - Poll for recording availability
- Configuration management for default settings

**Deepgram Manager** (`deepgram-manager.ts`):
- `transcribeRecording()` - Transcribe with business rules
- `transcribeWithInsights()` - Get conversation analytics
- `extractSummary()` - Create transcript summaries
- `calculateConversationStats()` - Analyze speaker patterns
- Default configuration for transcription quality

### 3️⃣ Resilience Layer

**Purpose**: Fault tolerance and reliability

**Plivo Resilient** (`plivo-resilient.ts`):
- **Circuit Breaker**: Prevents cascading failures
  - Opens after 50% error threshold
  - Resets after 30 seconds
  - Separate breakers for makeCall and getCallDetails
- **Exponential Backoff**: 1s → 2s → 4s → 8s (max 10s)
- **Retry Logic**: Up to 3 retries with backoff
- **Monitoring**: Circuit breaker state tracking

**Deepgram Resilient** (`deepgram-resilient.ts`):
- **Circuit Breaker**: Protects transcription service
  - 60-second timeout for long audio
  - 50% error threshold
  - 30-second reset
- **Exponential Backoff**: 2s → 4s → 8s → 16s (max 20s)
- **Retry Logic**: Up to 3 retries
- **Error Recovery**: Graceful degradation

## 🔄 Call Flow

### Complete Flow Diagram

```
User → Initiate Call
   │
   ↓
[POST /api/calls/initiate]
   │
   ├→ Auth Check (Supabase)
   ├→ Validate Phone Number
   └→ PlivoResilient.initiateRecordedCall()
       │
       ├→ Circuit Breaker Check
       ├→ Retry Logic (if needed)
       └→ PlivoManager.initiateRecordedCall()
           │
           └→ PlivoService.makeCall()
               │
               └→ Plivo API
                   │
                   ↓
                Call Connects
                   │
                   ↓
            [Plivo Callback]
       ← GET/POST /api/plivo/answer
           │
           └→ Return Recording XML
               │
               ↓
          Call Records
               │
               ↓
      [Recording Complete]
  ← POST /api/plivo/recording-callback
       │
       ├→ Store in Supabase (initial)
       └→ Trigger Async Transcription
           │
           └→ DeepgramResilient.transcribeRecording()
               │
               ├→ Circuit Breaker Check
               ├→ Retry Logic (if needed)
               └→ DeepgramManager.transcribeRecording()
                   │
                   └→ DeepgramService.transcribeFromUrl()
                       │
                       └→ Deepgram API
                           │
                           ↓
                    Transcription Complete
                           │
                           └→ Update Supabase
                               │
                               ↓
                          Ready for OpenAI Analysis
```

## 🚀 Usage Examples

### 1. Initiate a Call

```typescript
// POST /api/calls/initiate
const response = await fetch('/api/calls/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    to: '+1234567890',
    callerName: 'Your Business Name',
    timeLimit: 3600
  })
});

const data = await response.json();
// {
//   success: true,
//   callUuid: "abc-123-def",
//   message: "call fired",
//   retryCount: 1,
//   circuitBreakerState: "false"
// }
```

### 2. Get Call Details

```typescript
// GET /api/calls/details/:callUuid
const response = await fetch(`/api/calls/details/${callUuid}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
// {
//   callUuid: "abc-123-def",
//   fromNumber: "+1234567890",
//   toNumber: "+0987654321",
//   callStatus: "completed",
//   transcript: "Hello, this is a test...",
//   transcriptionConfidence: 0.95,
//   transcriptionStatus: "completed",
//   scamStatus: null, // Set by OpenAI later
//   ...
// }
```

### 3. Direct Client Usage (Advanced)

```typescript
import { getPlivoClient, getDeepgramClient } from '@/lib/clients';

// Plivo operations
const plivoClient = getPlivoClient();
const callResult = await plivoClient.initiateRecordedCall({
  to: '+1234567890',
  callerName: 'Test Call'
});

// Check resilience metrics
const stats = plivoClient.getCircuitBreakerStats();
console.log('Circuit breaker status:', stats);

// Deepgram operations
const deepgramClient = getDeepgramClient();
const transcription = await deepgramClient.transcribeRecording({
  recordingUrl: 'https://example.com/recording.mp3'
});

console.log('Transcript:', transcription.data?.transcript);
```

## ⚙️ Configuration Options

### Circuit Breaker Settings

```typescript
{
  circuitBreakerTimeout: 30000,              // Request timeout
  circuitBreakerErrorThresholdPercentage: 50, // Error % to open
  circuitBreakerResetTimeout: 30000,          // Time before retry
  circuitBreakerRollingCountTimeout: 10000,   // Stats window
  circuitBreakerRollingCountBuckets: 10       // Stats buckets
}
```

### Retry Settings

```typescript
{
  maxRetries: 3,           // Maximum retry attempts
  retryDelay: 1000,        // Initial delay (ms)
  retryMultiplier: 2,      // Exponential multiplier
  maxRetryDelay: 10000     // Maximum delay cap (ms)
}
```

## 🗄️ Database Schema

Required Supabase table:

```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_uuid TEXT UNIQUE NOT NULL,
  from_number TEXT,
  to_number TEXT,
  recording_url TEXT,
  recording_id TEXT,
  duration INTEGER,
  status TEXT,
  transcript TEXT,
  transcription_confidence FLOAT,
  transcription_duration FLOAT,
  transcription_status TEXT,
  transcription_error TEXT,
  word_count INTEGER,
  utterance_count INTEGER,
  detected_language TEXT,
  transcription_metadata JSONB,
  scam_status TEXT,
  scam_confidence FLOAT,
  scam_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔒 Security Considerations

1. **Authentication**: All API routes check Supabase auth
2. **Phone Validation**: Basic regex validation on phone numbers
3. **Rate Limiting**: Implement rate limiting in production
4. **CORS**: Configure CORS_ORIGINS environment variable
5. **API Keys**: Never expose in client-side code

## 📈 Monitoring

### Circuit Breaker Events

```typescript
const stats = plivoClient.getCircuitBreakerStats();
// {
//   makeCall: { opened: false, stats: {...} },
//   getCallDetails: { opened: false, stats: {...} }
// }
```

### Logs

All layers include comprehensive logging:
- `[PlivoResilient]` - Resilience layer events
- `[DeepgramResilient]` - Transcription resilience
- `[Call Initiate]` - API route operations
- `[Transcription]` - Async transcription process

## 🧪 Testing

```bash
# Test call initiation
curl -X POST http://localhost:3000/api/calls/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "+1234567890", "callerName": "Test"}'

# Test recording callback (simulate Plivo)
curl -X POST http://localhost:3000/api/plivo/recording-callback \
  -F "RecordingID=test-123" \
  -F "RecordingUrl=https://example.com/test.mp3" \
  -F "CallUUID=test-uuid" \
  -F "From=+1234567890" \
  -F "To=+0987654321"
```

## 🎯 Next Steps (OpenAI Integration - Step 3)

After transcription is complete:

1. Create OpenAI service layer
2. Implement scam detection logic
3. Update `calls` table with scam analysis
4. Build dashboard to display results

## 📚 Documentation Links

- [Plivo Voice API Docs](https://www.plivo.com/docs/voice/api/overview)
- [Deepgram STT API Docs](https://developers.deepgram.com/)
- [Opossum Circuit Breaker](https://nodeshift.dev/opossum/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

**Built with**: TypeScript, Next.js, Plivo SDK, Deepgram SDK, Opossum, Axios

**Architecture Pattern**: Three-Layer (Service → Manager → Resilience)

**Resilience Patterns**: Circuit Breaker, Exponential Backoff, Retry Logic
