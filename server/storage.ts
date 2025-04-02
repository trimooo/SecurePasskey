import { 
  User, 
  InsertUser, 
  Credential, 
  InsertCredential, 
  Challenge, 
  InsertChallenge,
  SavedPassword,
  InsertSavedPassword,
  MfaRecoveryCode,
  InsertMfaRecoveryCode,
  users,
  credentials,
  challenges,
  savedPasswords,
  mfaRecoveryCodes
} from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";
import { db, pool } from "./db";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

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
  
  // MFA Recovery Code methods
  getRecoveryCode(id: number): Promise<MfaRecoveryCode | undefined>;
  getRecoveryCodeByCode(code: string): Promise<MfaRecoveryCode | undefined>;
  getRecoveryCodesByUserId(userId: number): Promise<MfaRecoveryCode[]>;
  createRecoveryCode(recoveryCode: InsertMfaRecoveryCode): Promise<MfaRecoveryCode>;
  updateRecoveryCode(id: number, updates: Partial<MfaRecoveryCode>): Promise<MfaRecoveryCode | undefined>;
  deleteRecoveryCode(id: number): Promise<boolean>;
  deleteAllRecoveryCodesByUserId(userId: number): Promise<number>;
  
  // Session store for authentication
  getSessionStore(): session.Store;
}

export class DatabaseStorage implements IStorage {
  // Using a private property for the session store
  private _sessionStore: session.Store;
  
  constructor() {
    // Create PostgreSQL session store with connect-pg-simple
    const PgStore = connectPgSimple(session);
    
    // Initialize with proper PostgreSQL-backed session store
    this._sessionStore = new PgStore({
      pool,
      createTableIfMissing: true,
      tableName: 'session'
    });
  }
  
  // Implementation of interface method
  getSessionStore(): session.Store {
    return this._sessionStore;
  }
  
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
  
  // MFA Recovery Code methods
  async getRecoveryCode(id: number): Promise<MfaRecoveryCode | undefined> {
    const result = await db.select().from(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getRecoveryCodeByCode(code: string): Promise<MfaRecoveryCode | undefined> {
    const result = await db.select().from(mfaRecoveryCodes)
      .where(and(
        eq(mfaRecoveryCodes.code, code),
        eq(mfaRecoveryCodes.used, false)
      ));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getRecoveryCodesByUserId(userId: number): Promise<MfaRecoveryCode[]> {
    return await db.select().from(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
  }
  
  async createRecoveryCode(insertRecoveryCode: InsertMfaRecoveryCode): Promise<MfaRecoveryCode> {
    const result = await db.insert(mfaRecoveryCodes).values(insertRecoveryCode).returning();
    return result[0];
  }
  
  async updateRecoveryCode(id: number, updates: Partial<MfaRecoveryCode>): Promise<MfaRecoveryCode | undefined> {
    const result = await db.update(mfaRecoveryCodes)
      .set(updates)
      .where(eq(mfaRecoveryCodes.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }
  
  async deleteRecoveryCode(id: number): Promise<boolean> {
    const result = await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.id, id)).returning();
    return result.length > 0;
  }
  
  async deleteAllRecoveryCodesByUserId(userId: number): Promise<number> {
    const result = await db.delete(mfaRecoveryCodes)
      .where(eq(mfaRecoveryCodes.userId, userId))
      .returning();
    
    return result.length;
  }
}

// Import in-memory storage for development/testing
import { MemStorage } from './memory-storage';

// Create a resilient storage class that tries database first, falls back to in-memory if needed
class ResilientStorage implements IStorage {
  private dbStorage: DatabaseStorage;
  private memStorage: MemStorage;
  private useMemoryFallback: boolean = false;

  constructor() {
    this.dbStorage = new DatabaseStorage();
    this.memStorage = new MemStorage();
    console.log("Initialized resilient storage with database primary and in-memory fallback");
  }

  private async withFallback<T>(dbOperation: () => Promise<T>, memOperation: () => Promise<T>): Promise<T> {
    if (this.useMemoryFallback) {
      return memOperation();
    }

    try {
      return await dbOperation();
    } catch (error) {
      console.error("Database operation failed, falling back to in-memory:", error);
      this.useMemoryFallback = true;
      return memOperation();
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.withFallback(
      () => this.dbStorage.getUser(id),
      () => this.memStorage.getUser(id)
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.withFallback(
      () => this.dbStorage.getUserByEmail(email),
      () => this.memStorage.getUserByEmail(email)
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withFallback(
      () => this.dbStorage.getUserByUsername(username),
      () => this.memStorage.getUserByUsername(username)
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    return this.withFallback(
      () => this.dbStorage.createUser(user),
      () => this.memStorage.createUser(user)
    );
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    return this.withFallback(
      () => this.dbStorage.updateUser(id, updates),
      () => this.memStorage.updateUser(id, updates)
    );
  }

  // Credential methods
  async getCredential(id: number): Promise<Credential | undefined> {
    return this.withFallback(
      () => this.dbStorage.getCredential(id),
      () => this.memStorage.getCredential(id)
    );
  }

  async getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined> {
    return this.withFallback(
      () => this.dbStorage.getCredentialByCredentialId(credentialId),
      () => this.memStorage.getCredentialByCredentialId(credentialId)
    );
  }

  async getCredentialsByUserId(userId: number): Promise<Credential[]> {
    return this.withFallback(
      () => this.dbStorage.getCredentialsByUserId(userId),
      () => this.memStorage.getCredentialsByUserId(userId)
    );
  }

  async createCredential(credential: InsertCredential): Promise<Credential> {
    return this.withFallback(
      () => this.dbStorage.createCredential(credential),
      () => this.memStorage.createCredential(credential)
    );
  }

  async updateCredential(id: number, updates: Partial<Credential>): Promise<Credential | undefined> {
    return this.withFallback(
      () => this.dbStorage.updateCredential(id, updates),
      () => this.memStorage.updateCredential(id, updates)
    );
  }

  // Challenge methods
  async getChallenge(id: number): Promise<Challenge | undefined> {
    return this.withFallback(
      () => this.dbStorage.getChallenge(id),
      () => this.memStorage.getChallenge(id)
    );
  }

  async getChallengeByChallenge(challenge: string): Promise<Challenge | undefined> {
    return this.withFallback(
      () => this.dbStorage.getChallengeByChallenge(challenge),
      () => this.memStorage.getChallengeByChallenge(challenge)
    );
  }

  async getChallengesByUserId(userId: number): Promise<Challenge[]> {
    return this.withFallback(
      () => this.dbStorage.getChallengesByUserId(userId),
      () => this.memStorage.getChallengesByUserId(userId)
    );
  }

  async createChallenge(challenge: InsertChallenge): Promise<Challenge> {
    return this.withFallback(
      () => this.dbStorage.createChallenge(challenge),
      () => this.memStorage.createChallenge(challenge)
    );
  }

  async updateChallenge(id: number, updates: Partial<Challenge>): Promise<Challenge | undefined> {
    return this.withFallback(
      () => this.dbStorage.updateChallenge(id, updates),
      () => this.memStorage.updateChallenge(id, updates)
    );
  }

  async deleteChallenge(id: number): Promise<boolean> {
    return this.withFallback(
      () => this.dbStorage.deleteChallenge(id),
      () => this.memStorage.deleteChallenge(id)
    );
  }

  async deleteExpiredChallenges(): Promise<number> {
    return this.withFallback(
      () => this.dbStorage.deleteExpiredChallenges(),
      () => this.memStorage.deleteExpiredChallenges()
    );
  }

  // SavedPassword methods
  async getSavedPassword(id: number): Promise<SavedPassword | undefined> {
    return this.withFallback(
      () => this.dbStorage.getSavedPassword(id),
      () => this.memStorage.getSavedPassword(id)
    );
  }

  async getSavedPasswordsByUserId(userId: number): Promise<SavedPassword[]> {
    return this.withFallback(
      () => this.dbStorage.getSavedPasswordsByUserId(userId),
      () => this.memStorage.getSavedPasswordsByUserId(userId)
    );
  }

  async createSavedPassword(savedPassword: InsertSavedPassword): Promise<SavedPassword> {
    return this.withFallback(
      () => this.dbStorage.createSavedPassword(savedPassword),
      () => this.memStorage.createSavedPassword(savedPassword)
    );
  }

  async updateSavedPassword(id: number, updates: Partial<SavedPassword>): Promise<SavedPassword | undefined> {
    return this.withFallback(
      () => this.dbStorage.updateSavedPassword(id, updates),
      () => this.memStorage.updateSavedPassword(id, updates)
    );
  }

  async deleteSavedPassword(id: number): Promise<boolean> {
    return this.withFallback(
      () => this.dbStorage.deleteSavedPassword(id),
      () => this.memStorage.deleteSavedPassword(id)
    );
  }
  
  // MFA Recovery Code methods
  async getRecoveryCode(id: number): Promise<MfaRecoveryCode | undefined> {
    return this.withFallback(
      () => this.dbStorage.getRecoveryCode(id),
      () => this.memStorage.getRecoveryCode(id)
    );
  }
  
  async getRecoveryCodeByCode(code: string): Promise<MfaRecoveryCode | undefined> {
    return this.withFallback(
      () => this.dbStorage.getRecoveryCodeByCode(code),
      () => this.memStorage.getRecoveryCodeByCode(code)
    );
  }
  
  async getRecoveryCodesByUserId(userId: number): Promise<MfaRecoveryCode[]> {
    return this.withFallback(
      () => this.dbStorage.getRecoveryCodesByUserId(userId),
      () => this.memStorage.getRecoveryCodesByUserId(userId)
    );
  }
  
  async createRecoveryCode(recoveryCode: InsertMfaRecoveryCode): Promise<MfaRecoveryCode> {
    return this.withFallback(
      () => this.dbStorage.createRecoveryCode(recoveryCode),
      () => this.memStorage.createRecoveryCode(recoveryCode)
    );
  }
  
  async updateRecoveryCode(id: number, updates: Partial<MfaRecoveryCode>): Promise<MfaRecoveryCode | undefined> {
    return this.withFallback(
      () => this.dbStorage.updateRecoveryCode(id, updates),
      () => this.memStorage.updateRecoveryCode(id, updates)
    );
  }
  
  async deleteRecoveryCode(id: number): Promise<boolean> {
    return this.withFallback(
      () => this.dbStorage.deleteRecoveryCode(id),
      () => this.memStorage.deleteRecoveryCode(id)
    );
  }
  
  async deleteAllRecoveryCodesByUserId(userId: number): Promise<number> {
    return this.withFallback(
      () => this.dbStorage.deleteAllRecoveryCodesByUserId(userId),
      () => this.memStorage.deleteAllRecoveryCodesByUserId(userId)
    );
  }
  
  // Session store accessor - implements IStorage interface
  getSessionStore(): session.Store {
    return this.useMemoryFallback 
      ? this.memStorage.getSessionStore() 
      : this.dbStorage.getSessionStore();
  }
  
  // Backward compatibility with any code that might use this
  get sessionStore(): session.Store {
    return this.getSessionStore();
  }
}

// Initialize storage with resilient implementation
const storage = new ResilientStorage();

export { storage };
