// usbmkt/mktv2/MKTV2-mktv5/server/storage.ts

import { db } from './db.js';
import * as schema from '../shared/schema.js';
import type { LaunchPhase } from '../shared/schema.js'; // <-- Importação que faltava
import { eq, and, sql, desc, isNull, or, count, ilike } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type { FlowElementData } from '../shared/schema.js';

// ... (definições de tipo permanecem as mesmas)
type User = typeof schema.users.$inferSelect;
type Campaign = typeof schema.campaigns.$inferSelect;
type InsertCampaign = typeof schema.campaigns.$inferInsert;
// ... etc.

export const storage = {
    // ... (outros métodos permanecem os mesmos) ...

    // Copies (Método Corrigido)
    async getCopies(userId: number, campaignId?: number, phase?: string, purpose?: string, search?: string): Promise<schema.Copy[]> {
        const conditions = [eq(schema.copies.userId, userId)];

        if (campaignId) {
            conditions.push(eq(schema.copies.campaignId, campaignId));
        }
        if (phase) {
            conditions.push(eq(schema.copies.launchPhase, phase as LaunchPhase));
        }
        if (purpose) {
            conditions.push(eq(schema.copies.purposeKey, purpose));
        }
        if (search) {
            conditions.push(or(
                ilike(schema.copies.title, `%${search}%`),
                ilike(schema.copies.content, `%${search}%`)
            ));
        }

        return await db.query.copies.findMany({
            where: and(...conditions),
            orderBy: [desc(schema.copies.createdAt)],
        });
    },

    // ... (resto dos métodos de storage) ...

    // WhatsApp (Correção no deleteWhatsappTemplate para retornar boolean)
    async deleteWhatsappTemplate(id: number, userId: number): Promise<boolean> {
        const result = await db.delete(schema.whatsappMessageTemplates).where(and(eq(schema.whatsappMessageTemplates.id, id), eq(schema.whatsappMessageTemplates.userId, userId))).returning({ id: schema.whatsappMessageTemplates.id });
        return result.length > 0;
    },
    
    // ... (restante do arquivo storage.ts)
};
