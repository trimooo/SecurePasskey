import { 
  User, 
  InsertUser, 
  Credential, 
  InsertCredential, 
  Challenge, 
  InsertChallenge 
} from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private credentials: Map<number, Credential>;
  private challenges: Map<number, Challenge>;
  private userIdCounter: number;
  private credentialIdCounter: number;
  private challengeIdCounter: number;

  constructor() {
    this.users = new Map();
    this.credentials = new Map();
    this.challenges = new Map();
    this.userIdCounter = 1;
    this.credentialIdCounter = 1;
    this.challengeIdCounter = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id, registered: false };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Credential methods
  async getCredential(id: number): Promise<Credential | undefined> {
    return this.credentials.get(id);
  }

  async getCredentialByCredentialId(credentialId: string): Promise<Credential | undefined> {
    return Array.from(this.credentials.values()).find(
      (credential) => credential.credentialId === credentialId,
    );
  }

  async getCredentialsByUserId(userId: number): Promise<Credential[]> {
    return Array.from(this.credentials.values()).filter(
      (credential) => credential.userId === userId,
    );
  }

  async createCredential(insertCredential: InsertCredential): Promise<Credential> {
    const id = this.credentialIdCounter++;
    const now = new Date();
    const credential: Credential = { 
      ...insertCredential, 
      id,
      createdAt: now,
      transports: insertCredential.transports || null
    };
    this.credentials.set(id, credential);
    return credential;
  }

  async updateCredential(id: number, updates: Partial<Credential>): Promise<Credential | undefined> {
    const credential = await this.getCredential(id);
    if (!credential) return undefined;
    
    const updatedCredential = { ...credential, ...updates };
    this.credentials.set(id, updatedCredential);
    return updatedCredential;
  }

  // Challenge methods
  async getChallenge(id: number): Promise<Challenge | undefined> {
    return this.challenges.get(id);
  }

  async getChallengeByChallenge(challenge: string): Promise<Challenge | undefined> {
    return Array.from(this.challenges.values()).find(
      (ch) => ch.challenge === challenge,
    );
  }

  async getChallengesByUserId(userId: number): Promise<Challenge[]> {
    return Array.from(this.challenges.values()).filter(
      (challenge) => challenge.userId === userId,
    );
  }

  async createChallenge(insertChallenge: InsertChallenge): Promise<Challenge> {
    const id = this.challengeIdCounter++;
    const now = new Date();
    const challenge: Challenge = { 
      ...insertChallenge, 
      id,
      createdAt: now,
      userId: insertChallenge.userId || null,
      qrCode: insertChallenge.qrCode || null
    };
    this.challenges.set(id, challenge);
    return challenge;
  }

  async updateChallenge(id: number, updates: Partial<Challenge>): Promise<Challenge | undefined> {
    const challenge = await this.getChallenge(id);
    if (!challenge) return undefined;
    
    const updatedChallenge = { ...challenge, ...updates };
    this.challenges.set(id, updatedChallenge);
    return updatedChallenge;
  }

  async deleteChallenge(id: number): Promise<boolean> {
    return this.challenges.delete(id);
  }

  async deleteExpiredChallenges(): Promise<number> {
    const now = new Date();
    const expiredChallenges = Array.from(this.challenges.values()).filter(
      (challenge) => new Date(challenge.expiresAt) < now,
    );
    
    expiredChallenges.forEach((challenge) => {
      this.challenges.delete(challenge.id);
    });
    
    return expiredChallenges.length;
  }
}

export const storage = new MemStorage();
