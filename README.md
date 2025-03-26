# Secure Authentication System

A modern, secure authentication system with passkey registration, QR code login, and WebAuthn compliance, featuring an iOS-inspired design.

## Features

- **Passkey Registration**: Register new accounts using secure WebAuthn passkeys
- **QR Code Login**: Scan QR codes for seamless login across devices
- **Multiple Authentication Methods**: Support for email, passkeys, and QR codes
- **Persistent Data Storage**: PostgreSQL database integration
- **WebAuthn Compliance**: Implements the latest WebAuthn standards
- **iOS-Inspired Design**: Clean, minimalist interface with responsive layout

## Technology Stack

- **Frontend**: React with Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: WebAuthn/Passkey protocol
- **State Management**: TanStack Query and React Context API

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL database

### Installation

1. Clone the repository
   ```bash
   git clone <your-repo-url>
   cd <repo-name>
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   Create a `.env` file with the following:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/auth_db
   ```

4. Set up the database
   ```bash
   npm run db:push
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

## Deployment

This application can be deployed to any platform that supports Node.js and PostgreSQL:

1. Set up a PostgreSQL database
2. Configure environment variables on your hosting platform
3. Deploy the application code
4. Run database migrations

## Security Features

- Challenge-response authentication
- Secure, temporary challenge expiration
- Cryptographically secure passkeys
- Cross-device authentication with QR codes
- HTTPS-only communication

## License

[MIT](LICENSE)