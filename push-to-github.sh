#!/bin/bash

# Get command line arguments
if [ $# -ne 2 ]; then
  echo "Usage: $0 <github_username> <repository_name>"
  exit 1
fi

USERNAME=$1
REPO_NAME=$2
TOKEN=$GITHUB_TOKEN

# Check if GITHUB_TOKEN is set
if [ -z "$TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is not set."
  exit 1
fi

echo "Creating repository $REPO_NAME for user $USERNAME..."

# Create the repository on GitHub using the GitHub API
curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"A secure authentication system with passkey registration, QR code login, and WebAuthn compliance\",\"private\":false}" \
  > /dev/null

if [ $? -ne 0 ]; then
  echo "Failed to create repository. It might already exist or there was an error with the GitHub API."
else
  echo "Repository created successfully (or already exists)."
fi

# Add the remote origin
git remote remove origin 2>/dev/null
git remote add origin https://$TOKEN@github.com/$USERNAME/$REPO_NAME.git

if [ $? -ne 0 ]; then
  echo "Failed to add remote origin."
  exit 1
fi

echo "Remote origin added successfully."

# Initialize git if needed
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
  git add .
  git commit -m "Initial commit"
fi

# Make sure we're on main branch
if [ "$(git branch --show-current)" != "main" ]; then
  echo "Switching to main branch..."
  git branch -M main
fi

# Push to GitHub
echo "Pushing code to GitHub..."
git push -u origin main --force

if [ $? -ne 0 ]; then
  echo "Failed to push code to GitHub."
  exit 1
fi

echo "Code successfully pushed to GitHub!"
echo "Repository URL: https://github.com/$USERNAME/$REPO_NAME"