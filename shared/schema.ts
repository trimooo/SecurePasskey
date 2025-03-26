import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  registered: boolean("registered").notNull().default(false),
});

export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull(),
  transports: text("transports").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  challenge: text("challenge").notNull(),
  type: text("type").notNull(), // 'registration' or 'authentication'
  qrCode: text("qr_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Insert schemas

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  username: true,
});

export const insertCredentialSchema = createInsertSchema(credentials).pick({
  userId: true,
  credentialId: true,
  publicKey: true,
  counter: true,
  transports: true,
});

export const insertChallengeSchema = createInsertSchema(challenges).pick({
  userId: true,
  challenge: true,
  type: true,
  qrCode: true,
  expiresAt: true,
});

// Types

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;

export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

// Extended schemas
export const webAuthnRegistrationInputSchema = z.object({
  email: z.string().email(),
});

export const webAuthnLoginInputSchema = z.object({
  email: z.string().email(),
});
