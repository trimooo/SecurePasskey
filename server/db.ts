import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Check if DATABASE_URL is set
const databaseUrl = process.env.DATABASE_URL;

// Create mock implementations or use actual database based on availability
let pool;
let db;

if (!databaseUrl) {
  console.warn("DATABASE_URL not set. Using mock database implementation.");
  
  // Create mock implementations for your database operations
  db = {
    // Add mock implementations for the database methods you use
    // For example:
    query: async () => ({ rows: [] }),
    select: () => ({ execute: async () => [] }),
    insert: () => ({ values: () => ({ returning: () => ({ execute: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: () => ({ execute: async () => [] }) }) }),
    delete: () => ({ where: () => ({ execute: async () => [] }) }),
    // Add other methods as needed
  };
  
  // Create a mock pool that won't be used but prevents errors
  pool = {
    connect: async () => ({}),
    end: async () => {},
  };
} else {
  // Use the actual database when DATABASE_URL is available
  pool = new Pool({ connectionString: databaseUrl });
  db = drizzle(pool, { schema });
}

export { pool, db };
