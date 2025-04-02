# Secure Authentication System

A modern, secure authentication system featuring passkey registration, QR code login, and WebAuthn compliance in an iOS-inspired design.

## Features

- **Modern Passkey Authentication**: Register and login with FIDO2 compatible security keys or platform authenticators
- **QR Code Login**: Easily login from another device by scanning a QR code
- **WebAuthn Compliance**: Uses the latest web standards for strong authentication
- **iOS-Inspired Design**: Clean, minimalist interface with intuitive user experience
- **Secure**: Challenge-response based authentication with temporary challenge expiration
- **Database Persistence**: All user data and credentials stored in PostgreSQL

## Tech Stack

- **Frontend**: React with Vite, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: WebAuthn/Passkey protocol
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Context API and React Query

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL database
- Git

### Local Development Setup

1. Clone the repository
   ```
   git clone https://github.com/[YOUR_USERNAME]/Auth-System.git
   cd Auth-System
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`
   ```
   cp .env.example .env
   ```

4. Update the `.env` file with your PostgreSQL database credentials:
   ```
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/auth_db
   PORT=5000
   NODE_ENV=development
   SESSION_SECRET=your_local_development_secret
   ORIGIN=http://localhost:5000
   ```

5. Create a local PostgreSQL database:
   ```
   psql -U postgres
   CREATE DATABASE auth_db;
   \q
   ```

6. Push the database schema
   ```
   npm run db:push
   ```

7. Start the development server
   ```
   npm run dev
   ```

8. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

### VS Code Configuration

For the best development experience in VS Code:

1. Install recommended extensions:
   - ESLint
   - Prettier
   - TypeScript and JavaScript Language Features
   - Tailwind CSS IntelliSense

2. Add the following settings to your VS Code workspace settings:
   ```json
   {
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     },
     "typescript.tsdk": "node_modules/typescript/lib"
   }
   ```

## Deployment

The project can be deployed to any platform that supports Node.js applications with PostgreSQL databases.

### Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Port to run the server on (defaults to 5000)
- `SESSION_SECRET`: Secret for session encryption

## License

This project is licensed under the MIT License - see the LICENSE file for details.