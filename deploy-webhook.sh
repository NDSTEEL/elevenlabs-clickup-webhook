#!/bin/bash

# Deploy ElevenLabs Webhook to Vercel
# Run this script to deploy your webhook

echo "🚀 Deploying ElevenLabs Webhook to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Login to Vercel if not already logged in
echo "🔑 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "📋 Please login to Vercel:"
    vercel login
fi

# Deploy to production
echo "📦 Deploying to Vercel..."
vercel --prod --yes

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the deployment URL from above"
echo "2. Add '/webhook/elevenlabs' to the end"
echo "3. Update ElevenLabs webhook URL to: [YOUR_URL]/webhook/elevenlabs"
echo "4. Use webhook secret: wsec_83300744d4151d3c6e3dcedce65d1ad7d0f60b44eebc9ce2a540ffc8b95bd7d4"
echo ""
echo "🎉 Your ElevenLabs → ClickUp webhook is ready!"