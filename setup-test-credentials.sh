#!/bin/bash

# Setup script for Haier Evo test credentials
# This script helps you configure environment variables for testing

echo "🔐 Haier Evo Test Credentials Setup"
echo "===================================="
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "📁 Found existing .env file"
    source .env
else
    echo "📁 No .env file found, creating one..."
    touch .env
fi

echo ""
echo "Please provide your Haier Evo API credentials:"
echo ""

# Get email
if [ -z "$HAIER_EVO_EMAIL" ]; then
    read -p "Email: " email
    echo "HAIER_EVO_EMAIL=$email" >> .env
else
    echo "✅ Email already configured: $HAIER_EVO_EMAIL"
fi

# Get password
if [ -z "$HAIER_EVO_PASSWORD" ]; then
    read -s -p "Password: " password
    echo ""
    echo "HAIER_EVO_PASSWORD=$password" >> .env
else
    echo "✅ Password already configured: [HIDDEN]"
fi

# Get region
if [ -z "$HAIER_EVO_REGION" ]; then
    read -p "Region (default: ru): " region
    region=${region:-ru}
    echo "HAIER_EVO_REGION=$region" >> .env
else
    echo "✅ Region already configured: $HAIER_EVO_REGION"
fi

# Get device ID (optional)
if [ -z "$HAIER_EVO_DEVICE_ID" ]; then
    read -p "Device ID (optional, press Enter to skip): " device_id
    if [ ! -z "$device_id" ]; then
        echo "HAIER_EVO_DEVICE_ID=$device_id" >> .env
        echo "✅ Device ID configured: $device_id"
    else
        echo "ℹ️  Device ID skipped (will use default)"
    fi
else
    echo "✅ Device ID already configured: $HAIER_EVO_DEVICE_ID"
fi

# Add other test configuration
echo "TEST_TIMEOUT=30000" >> .env
echo "TEST_RETRY_ATTEMPTS=3" >> .env
echo "TEST_RETRY_DELAY=1000" >> .env
echo "DEBUG=1" >> .env
echo "RUN_REAL_API_TESTS=1" >> .env

echo ""
echo "🎉 Credentials setup complete!"
echo ""
echo "📋 To use these credentials, run:"
echo "   source .env"
echo "   RUN_REAL_API_TESTS=1 npm run test:standalone:api"
echo ""
echo "🔒 Your credentials are stored in .env file"
echo "   Make sure to add .env to your .gitignore file!"
echo ""
echo "⚠️  Note: The .env file contains sensitive information."
echo "   Never commit it to version control!"
