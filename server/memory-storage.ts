import { 
  User, 
  InsertUser, 
  Credential, 
  InsertCredential, 
  Challenge, 
  InsertChallenge
} from "@shared/schema";
import { IStorage } from "./storage";

// In-memory storage implementation for testing/development
export class MemStorage implements IStorage {
  private users: User[] = [];
  private credentials: Credential[] = [];
  private challenges: Challenge[] = [];
  private nextUserId = 1;
  private nextCredentialId = 1;
  private nextChallengeId = 1;

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
}