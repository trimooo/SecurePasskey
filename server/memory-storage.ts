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
  InsertMfaRecoveryCode
} from "@shared/schema";
import type { IStorage } from "./storage";
import MemoryStore from "memorystore";
import session from "express-session";

// Create a memory store for session
const MemorySessionStore = MemoryStore(session);

// In-memory storage implementation for testing/development
export class MemStorage implements IStorage {
  private users: User[] = [];
  private credentials: Credential[] = [];
  private challenges: Challenge[] = [];
  private savedPasswords: SavedPassword[] = [];
  private recoveryCodeCache: MfaRecoveryCode[] = [];
  private nextUserId = 1;
  private nextCredentialId = 1;
  private nextChallengeId = 1;
  private nextSavedPasswordId = 1;
  private nextRecoveryCodeId = 1;
  
  // Initialize session store
  private _sessionStore = new MemorySessionStore({
    checkPeriod: 86400000 // once per day cleanup
  });
  
  // Implement getSessionStore method required by IStorage interface
  getSessionStore(): session.Store {
    return this._sessionStore;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(user => user.email === email);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    const user: User = {
      id,
      ...insertUser,
      registered: false,
      verificationCode: null,
      verificationExpiry: null,
      lastLogin: null,
      phone: insertUser.phone || null,
      mfaEnabled: insertUser.mfaEnabled || false,
      mfaType: insertUser.mfaType || null,
      mfaSecret: insertUser.mfaSecret || null,
      password: insertUser.password || null,
      name: insertUser.name || null
    };
    this.users.push(user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return undefined;
    
    const user = this.users[index];
    const updatedUser = { ...user, ...updates };
    this.users[index] = updatedUser;
    return updatedUser;
  }

  // Credential methods
  async getCredential(id: number): Promise<Credential | undefined> {
    return this.credentials.find(cred => cred.id === id);
  }

  async getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined> {
    return this.credentials.find(cred => cred.credentialId === credentialId);
  }

  async getCredentialsByUserId(userId: number): Promise<Credential[]> {
    return this.credentials.filter(cred => cred.userId === userId);
  }

  async createCredential(insertCredential: InsertCredential): Promise<Credential> {
    const id = this.nextCredentialId++;
    const now = new Date();
    const credential: Credential = {
      id,
      userId: insertCredential.userId,
      credentialId: insertCredential.credentialId,
      publicKey: insertCredential.publicKey,
      counter: insertCredential.counter,
      transports: insertCredential.transports || null,
      createdAt: now,
    };
    this.credentials.push(credential);
    return credential;
  }

  async updateCredential(id: number, updates: Partial<Credential>): Promise<Credential | undefined> {
    const index = this.credentials.findIndex(cred => cred.id === id);
    if (index === -1) return undefined;
    
    const credential = this.credentials[index];
    const updatedCredential = { ...credential, ...updates };
    this.credentials[index] = updatedCredential;
    return updatedCredential;
  }

  // Challenge methods
  async getChallenge(id: number): Promise<Challenge | undefined> {
    return this.challenges.find(challenge => challenge.id === id);
  }

  async getChallengeByChallenge(challenge: string): Promise<Challenge | undefined> {
    return this.challenges.find(c => c.challenge === challenge);
  }

  async getChallengesByUserId(userId: number): Promise<Challenge[]> {
    return this.challenges.filter(challenge => challenge.userId === userId);
  }

  async createChallenge(insertChallenge: InsertChallenge): Promise<Challenge> {
    const id = this.nextChallengeId++;
    const now = new Date();
    const challenge: Challenge = {
      id,
      type: insertChallenge.type,
      userId: insertChallenge.userId || null,
      challenge: insertChallenge.challenge,
      qrCode: insertChallenge.qrCode || null,
      createdAt: now,
      expiresAt: insertChallenge.expiresAt,
    };
    this.challenges.push(challenge);
    return challenge;
  }

  async updateChallenge(id: number, updates: Partial<Challenge>): Promise<Challenge | undefined> {
    const index = this.challenges.findIndex(challenge => challenge.id === id);
    if (index === -1) return undefined;
    
    const challenge = this.challenges[index];
    const updatedChallenge = { ...challenge, ...updates };
    this.challenges[index] = updatedChallenge;
    return updatedChallenge;
  }

  async deleteChallenge(id: number): Promise<boolean> {
    const initialLength = this.challenges.length;
    this.challenges = this.challenges.filter(challenge => challenge.id !== id);
    return this.challenges.length !== initialLength;
  }

  async deleteExpiredChallenges(): Promise<number> {
    const now = new Date();
    const initialLength = this.challenges.length;
    this.challenges = this.challenges.filter(challenge => new Date(challenge.expiresAt) > now);
    return initialLength - this.challenges.length;
  }

  // SavedPassword methods
  async getSavedPassword(id: number): Promise<SavedPassword | undefined> {
    return this.savedPasswords.find(pwd => pwd.id === id);
  }

  async getSavedPasswordsByUserId(userId: number): Promise<SavedPassword[]> {
    return this.savedPasswords.filter(pwd => pwd.userId === userId);
  }

  async createSavedPassword(insertSavedPassword: InsertSavedPassword): Promise<SavedPassword> {
    const id = this.nextSavedPasswordId++;
    const now = new Date();
    const savedPassword: SavedPassword = {
      id,
      userId: insertSavedPassword.userId,
      website: insertSavedPassword.website,
      url: insertSavedPassword.url || null,
      username: insertSavedPassword.username,
      password: insertSavedPassword.password,
      notes: insertSavedPassword.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.savedPasswords.push(savedPassword);
    return savedPassword;
  }

  async updateSavedPassword(id: number, updates: Partial<SavedPassword>): Promise<SavedPassword | undefined> {
    const index = this.savedPasswords.findIndex(pwd => pwd.id === id);
    if (index === -1) return undefined;
    
    const savedPassword = this.savedPasswords[index];
    const updatedSavedPassword = { 
      ...savedPassword, 
      ...updates,
      updatedAt: new Date() 
    };
    this.savedPasswords[index] = updatedSavedPassword;
    return updatedSavedPassword;
  }

  async deleteSavedPassword(id: number): Promise<boolean> {
    const initialLength = this.savedPasswords.length;
    this.savedPasswords = this.savedPasswords.filter(pwd => pwd.id !== id);
    return this.savedPasswords.length !== initialLength;
  }
  
  // MFA Recovery Code methods
  async getRecoveryCode(id: number): Promise<MfaRecoveryCode | undefined> {
    return this.recoveryCodeCache.find(code => code.id === id);
  }
  
  async getRecoveryCodeByCode(code: string): Promise<MfaRecoveryCode | undefined> {
    return this.recoveryCodeCache.find(c => c.code === code && !c.used);
  }
  
  async getRecoveryCodesByUserId(userId: number): Promise<MfaRecoveryCode[]> {
    return this.recoveryCodeCache.filter(code => code.userId === userId);
  }
  
  async createRecoveryCode(insertRecoveryCode: InsertMfaRecoveryCode): Promise<MfaRecoveryCode> {
    const id = this.nextRecoveryCodeId++;
    const now = new Date();
    const recoveryCode: MfaRecoveryCode = {
      id,
      userId: insertRecoveryCode.userId,
      code: insertRecoveryCode.code,
      used: insertRecoveryCode.used || false,
      createdAt: now,
      usedAt: null
    };
    this.recoveryCodeCache.push(recoveryCode);
    return recoveryCode;
  }
  
  async updateRecoveryCode(id: number, updates: Partial<MfaRecoveryCode>): Promise<MfaRecoveryCode | undefined> {
    const index = this.recoveryCodeCache.findIndex(code => code.id === id);
    if (index === -1) return undefined;
    
    const recoveryCode = this.recoveryCodeCache[index];
    const updatedRecoveryCode = { ...recoveryCode, ...updates };
    this.recoveryCodeCache[index] = updatedRecoveryCode;
    return updatedRecoveryCode;
  }
  
  async deleteRecoveryCode(id: number): Promise<boolean> {
    const initialLength = this.recoveryCodeCache.length;
    this.recoveryCodeCache = this.recoveryCodeCache.filter(code => code.id !== id);
    return this.recoveryCodeCache.length !== initialLength;
  }
  
  async deleteAllRecoveryCodesByUserId(userId: number): Promise<number> {
    const initialLength = this.recoveryCodeCache.length;
    this.recoveryCodeCache = this.recoveryCodeCache.filter(code => code.userId !== userId);
    return initialLength - this.recoveryCodeCache.length;
  }
}