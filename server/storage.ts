import { 
  User, 
  InsertUser, 
  Credential, 
  InsertCredential, 
  Challenge, 
  InsertChallenge,
  SavedPassword,
  InsertSavedPassword,
  users,
  credentials,
  challenges,
  savedPasswords
} from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // Credential methods
  getCredential(id: number): Promise<Credential | undefined>;
  getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined>;
  getCredentialsByUserId(userId: number): Promise<Credential[]>;
  createCredential(credential: InsertCredential): Promise<Credential>;
  updateCredential(id: number, updates: Partial<Credential>): Promise<Credential | undefined>;
  
  // Challenge methods
  getChallenge(id: number): Promise<Challenge | undefined>;
  getChallengeByChallenge(challenge: string): Promise<Challenge | undefined>;
  getChallengesByUserId(userId: number): Promise<Challenge[]>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  updateChallenge(id: number, updates: Partial<Challenge>): Promise<Challenge | undefined>;
  deleteChallenge(id: number): Promise<boolean>;
  deleteExpiredChallenges(): Promise<number>;
  
  // SavedPassword methods
  getSavedPassword(id: number): Promise<SavedPassword | undefined>;
  getSavedPasswordsByUserId(userId: number): Promise<SavedPassword[]>;
  createSavedPassword(savedPassword: InsertSavedPassword): Promise<SavedPassword>;
  updateSavedPassword(id: number, updates: Partial<SavedPassword>): Promise<SavedPassword | undefined>;
  deleteSavedPassword(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      registered: false
    }).returning();
    
    return result[0];
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  // Credential methods
  async getCredential(id: number): Promise<Credential | undefined> {
    const result = await db.select().from(credentials).where(eq(credentials.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined> {
    const result = await db.select().from(credentials).where(eq(credentials.credentialId, credentialId));
    return result.length > 0 ? result[0] : undefined;
  }

  async getCredentialsByUserId(userId: number): Promise<Credential[]> {
    return await db.select().from(credentials).where(eq(credentials.userId, userId));
  }

  async createCredential(insertCredential: InsertCredential): Promise<Credential> {
    const result = await db.insert(credentials).values(insertCredential).returning();
    return result[0];
  }

  async updateCredential(id: number, updates: Partial<Credential>): Promise<Credential | undefined> {
    const result = await db.update(credentials)
      .set(updates)
      .where(eq(credentials.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  // Challenge methods
  async getChallenge(id: number): Promise<Challenge | undefined> {
    const result = await db.select().from(challenges).where(eq(challenges.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getChallengeByChallenge(challenge: string): Promise<Challenge | undefined> {
    const result = await db.select().from(challenges).where(eq(challenges.challenge, challenge));
    return result.length > 0 ? result[0] : undefined;
  }

  async getChallengesByUserId(userId: number): Promise<Challenge[]> {
    return await db.select().from(challenges).where(eq(challenges.userId, userId));
  }

  async createChallenge(insertChallenge: InsertChallenge): Promise<Challenge> {
    const result = await db.insert(challenges).values(insertChallenge).returning();
    return result[0];
  }

  async updateChallenge(id: number, updates: Partial<Challenge>): Promise<Challenge | undefined> {
    const result = await db.update(challenges)
      .set(updates)
      .where(eq(challenges.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteChallenge(id: number): Promise<boolean> {
    const result = await db.delete(challenges).where(eq(challenges.id, id)).returning();
    return result.length > 0;
  }

  async deleteExpiredChallenges(): Promise<number> {
    const now = new Date();
    const result = await db.delete(challenges)
      .where(lt(challenges.expiresAt, now))
      .returning();
    
    return result.length;
  }

  // SavedPassword methods
  async getSavedPassword(id: number): Promise<SavedPassword | undefined> {
    const result = await db.select().from(savedPasswords).where(eq(savedPasswords.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getSavedPasswordsByUserId(userId: number): Promise<SavedPassword[]> {
    return await db.select().from(savedPasswords).where(eq(savedPasswords.userId, userId));
  }

  async createSavedPassword(insertSavedPassword: InsertSavedPassword): Promise<SavedPassword> {
    const now = new Date();
    const result = await db.insert(savedPasswords).values({
      ...insertSavedPassword,
      createdAt: now,
      updatedAt: now
    }).returning();
    return result[0];
  }

  async updateSavedPassword(id: number, updates: Partial<SavedPassword>): Promise<SavedPassword | undefined> {
    const now = new Date();
    const result = await db.update(savedPasswords)
      .set({
        ...updates,
        updatedAt: now
      })
      .where(eq(savedPasswords.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteSavedPassword(id: number): Promise<boolean> {
    const result = await db.delete(savedPasswords).where(eq(savedPasswords.id, id)).returning();
    return result.length > 0;
  }
}

// Import in-memory storage for development/testing
import { MemStorage } from './memory-storage';

// Use in-memory storage due to database connection issues
// export const storage = new DatabaseStorage();
export const storage = new MemStorage();
