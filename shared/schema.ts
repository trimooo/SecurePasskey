import { pgTable, text, serial, integer, boolean, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define tables first
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  registered: boolean("registered").notNull().default(false),
  verificationCode: text("verification_code"),
  verificationExpiry: timestamp("verification_expiry"),
});

export const credentials = pgTable("credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull(),
  transports: text("transports").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  challenge: text("challenge").notNull(),
  type: text("type").notNull(), // 'registration' or 'authentication'
  qrCode: text("qr_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Password manager table
export const savedPasswords = pgTable("saved_passwords", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  website: text("website").notNull(),
  url: text("url"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Define relations after all tables are declared
export const usersRelations = relations(users, ({ many }) => ({
  credentials: many(credentials),
  challenges: many(challenges),
  savedPasswords: many(savedPasswords),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  user: one(users, {
    fields: [credentials.userId],
    references: [users.id],
  }),
}));

export const challengesRelations = relations(challenges, ({ one }) => ({
  user: one(users, {
    fields: [challenges.userId],
    references: [users.id],
  }),
}));

export const savedPasswordsRelations = relations(savedPasswords, ({ one }) => ({
  user: one(users, {
    fields: [savedPasswords.userId],
    references: [users.id],
  }),
}));

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

export const insertChallengeSchema = createInsertSchema(challenges)
  .pick({
    userId: true,
    challenge: true,
    type: true,
    qrCode: true,
    expiresAt: true,
  });
// Note: userId is already optional because it's not marked as notNull in the table definition

export const insertSavedPasswordSchema = createInsertSchema(savedPasswords)
  .pick({
    userId: true,
    website: true,
    url: true,
    username: true,
    password: true,
    notes: true,
  });

// Types

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;

export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

export type InsertSavedPassword = z.infer<typeof insertSavedPasswordSchema>;
export type SavedPassword = typeof savedPasswords.$inferSelect;

// Extended schemas
export const webAuthnRegistrationInputSchema = z.object({
  email: z.string().email(),
});

export const webAuthnLoginInputSchema = z.object({
  email: z.string().email(),
});
