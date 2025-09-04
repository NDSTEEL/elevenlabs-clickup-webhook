// Vercel API Route for ElevenLabs Webhook
// Based on working webhook-production-fixed.js

import crypto from 'crypto';

// Configuration
const ELEVENLABS_WEBHOOK_SECRET = 'wsec_83300744d4151d3c6e3dcedce65d1ad7d0f60b44eebc9ce2a540ffc8b95bd7d4';
const CLICKUP_API_TOKEN = 'pk_68582715_2FDIJNPRG2C4AZ3EKG563NN83H20Q6G1';
const LIST_ID = '901513394496';

// Field IDs from ClickUp
const FIELD_IDS = {
  customerName: 'b3e9667b-2d90-412b-b1fb-c783a69d70f0',
  phoneNumber: '3cdf9570-f0ea-47bd-a25e-eabaf3cbd4cb',
  email: 'ec1fd5ae-9c0b-46a4-9e0f-0a416866b705',
  companyName: '47ba02ae-edc2-45c4-81fd-2aa430f0631b',
  jobTitle: 'd7f4b5bb-34a6-4afc-9fea-31f4a061689d',
  callSummary: '478c4aea-68cb-45d9-b593-1b756153ef15',
  elevenlabsCallId: '74e33843-dc69-49b6-95c8-0617cd86278c',
  disposition: '15bf32f7-9532-4655-a952-384789df9fd9',
  aiSentiment: '8013d8c7-89a9-4b32-a128-59306ffb42ef',
  leadTemperature: '64a826e5-5c40-4f90-8fdd-1e5705a33bac',
  priority: '639fe8aa-0a56-424c-a9ee-b013db24c45f'
};

// Dropdown mappings
const DROPDOWN_OPTIONS = {
  disposition: {
    'Interested': 0,
    'Not Interested': 1,
    'RFQ Requested': 2,
    'Do Not Call': 3,
    'Callback - Specific Time': 4,
    'Callback - General': 5,
    'Callback - Missed': 6,
    'Converted': 7,
    'Duplicate': 8
  },
  aiSentiment: {
    'positive': 1,
    'neutral': 0, 
    'negative': 2
  },
  leadTemperature: {
    'hot': 0,
    'warm': 1,
    'cold': 2
  }
};

// Verify HMAC signature
function verifySignature(body, signature, secret) {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return computedSignature === signature;
}

// Extract call data from ElevenLabs payload
function extractCallData(body) {
  const data = body.data || {};
  const metadata = data.metadata || {};
  
  return {
    conversationId: body.conversation_id,
    phone: metadata.phone_number,
    email: metadata.email,
    customerName: metadata.customer_name,
    companyName: metadata.company_name,
    disposition: metadata.disposition,
    sentiment: metadata.sentiment,
    duration: data.duration_seconds || data.duration,
    callSummary: data.transcript || data.summary || ''
  };
}

// Create ClickUp task
async function createClickUpTask(callData) {
  const customFields = [];
  
  // Add text fields
  if (callData.customerName) customFields.push({ id: FIELD_IDS.customerName, value: callData.customerName });
  if (callData.phone) customFields.push({ id: FIELD_IDS.phoneNumber, value: callData.phone });
  if (callData.email) customFields.push({ id: FIELD_IDS.email, value: callData.email });
  if (callData.companyName) customFields.push({ id: FIELD_IDS.companyName, value: callData.companyName });
  if (callData.callSummary) customFields.push({ id: FIELD_IDS.callSummary, value: callData.callSummary });
  if (callData.conversationId) customFields.push({ id: FIELD_IDS.elevenlabsCallId, value: callData.conversationId });

  // Add dropdown fields
  if (callData.disposition && DROPDOWN_OPTIONS.disposition[callData.disposition] !== undefined) {
    customFields.push({ 
      id: FIELD_IDS.disposition, 
      value: DROPDOWN_OPTIONS.disposition[callData.disposition].toString()
    });
  }

  if (callData.sentiment && DROPDOWN_OPTIONS.aiSentiment[callData.sentiment] !== undefined) {
    customFields.push({ 
      id: FIELD_IDS.aiSentiment, 
      value: DROPDOWN_OPTIONS.aiSentiment[callData.sentiment].toString()
    });
  }

  const taskData = {
    name: `Lead - ${callData.phone || 'Unknown'} - ${callData.customerName || 'Unknown'}`,
    description: `ElevenLabs call ${callData.conversationId}\n\nCall Duration: ${callData.duration}s\nDisposition: ${callData.disposition}\nSentiment: ${callData.sentiment}`,
    tags: ['elevenlabs', 'webhook'],
    custom_fields: customFields
  };

  const response = await fetch(`https://api.clickup.com/api/v2/list/${LIST_ID}/task`, {
    method: 'POST',
    headers: {
      'Authorization': CLICKUP_API_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`ClickUp API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

// Main handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, elevenlabs-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'ElevenLabs-ClickUp Integration',
      message: 'Webhook endpoint ready',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    try {
      console.log('=== WEBHOOK RECEIVED ===');
      console.log('Headers:', req.headers);
      console.log('Body keys:', Object.keys(req.body || {}));

      const rawBody = JSON.stringify(req.body);
      const signature = req.headers['elevenlabs-signature'];

      // Verify signature
      if (signature) {
        const isValid = verifySignature(rawBody, signature, ELEVENLABS_WEBHOOK_SECRET);
        if (!isValid) {
          console.log('Invalid signature');
          return res.status(401).json({ success: false, error: 'Invalid signature' });
        }
        console.log('Signature verified');
      } else {
        console.log('No signature provided - proceeding without verification');
      }

      // Extract call data
      const callData = extractCallData(req.body);
      console.log('Extracted call data:', callData);

      // Validate required fields
      if (!callData.conversationId && !callData.phone) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: conversation_id or phone_number' 
        });
      }

      // Create ClickUp task
      const result = await createClickUpTask(callData);
      console.log('ClickUp task created:', result.id);

      return res.status(200).json({
        success: true,
        message: 'ElevenLabs webhook processed successfully',
        clickup_task_id: result.id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Webhook processing error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}