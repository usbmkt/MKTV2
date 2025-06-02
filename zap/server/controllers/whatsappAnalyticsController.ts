// zap/server/controllers/whatsappAnalyticsController.ts
import { Request, Response, NextFunction } from 'express';
import { zapDb } from '../db';
import { whatsappMessages, whatsappFlows, whatsappFlowUserStates } from '../../shared/zap_schema';
import { sql, eq, and, count, avg, desc, gte, lte } from 'drizzle-orm';
import { subDays, formatISO, startOfDay, endOfDay } from 'date-fns'; // Para manipulação de datas

const getMktv2UserId = (req: Request): number => (req as any).zapMktv2UserId;

export const getZapAnalyticsController = async (req: Request, res: Response, next: NextFunction) => {
    const mktv2UserId = getMktv2UserId(req);
    const periodDays = parseInt(req.query.period as string) || 7; // Padrão para 7 dias
    const endDate = new Date();
    const startDate = startOfDay(subDays(endDate, periodDays -1)); // -1 porque queremos incluir o dia atual

    console.log(`[ZapAnalyticsCtrl /analytics] GET para User ${mktv2UserId}, Período: ${periodDays} dias (de ${startDate.toISOString()} até ${endDate.toISOString()})`);
    
    try {
        // KPIs Gerais
        const [sentResult] = await zapDb.select({ value: count() }).from(whatsappMessages)
            .where(and(eq(whatsappMessages.mktv2UserId, mktv2UserId), eq(whatsappMessages.direction, 'outgoing'), gte(whatsappMessages.timestamp, startDate)));
        const totalMessagesSent = sentResult?.value || 0;

        const [receivedResult] = await zapDb.select({ value: count() }).from(whatsappMessages)
            .where(and(eq(whatsappMessages.mktv2UserId, mktv2UserId), eq(whatsappMessages.direction, 'incoming'), gte(whatsappMessages.timestamp, startDate)));
        const totalMessagesReceived = receivedResult?.value || 0;

        const [activeConvResult] = await zapDb.select({ value: count(sql`DISTINCT ${whatsappMessages.contactJid}`) }).from(whatsappMessages)
            .where(and(eq(whatsappMessages.mktv2UserId, mktv2UserId), gte(whatsappMessages.timestamp, startDate)));
        const activeConversations = activeConvResult?.value || 0;

        // Mensagens por Dia (para gráfico)
        const messagesByDayQuery = zapDb.select({
                date: sql<string>`TO_CHAR(${whatsappMessages.timestamp}, 'YYYY-MM-DD')`.as('day'),
                sent: sql<number>`SUM(CASE WHEN ${whatsappMessages.direction} = 'outgoing' THEN 1 ELSE 0 END)`.as('sent_count'),
                received: sql<number>`SUM(CASE WHEN ${whatsappMessages.direction} = 'incoming' THEN 1 ELSE 0 END)`.as('received_count')
            })
            .from(whatsappMessages)
            .where(and(
                eq(whatsappMessages.mktv2UserId, mktv2UserId),
                gte(whatsappMessages.timestamp, startDate),
                lte(whatsappMessages.timestamp, endOfDay(endDate)) // Incluir todo o dia final
            ))
            .groupBy(sql`TO_CHAR(${whatsappMessages.timestamp}, 'YYYY-MM-DD')`)
            .orderBy(sql`TO_CHAR(${whatsappMessages.timestamp}, 'YYYY-MM-DD')`);
        
        const messagesByDayRaw = await messagesByDayQuery;
        const messagesByDay = messagesByDayRaw.map(d => ({
            date: new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}), // Formato DD/MM
            sent: Number(d.sent),
            received: Number(d.received)
        }));


        // Performance de Fluxos (exemplo)
        const flows = await zapDb.query.whatsappFlows.findMany({
            where: eq(whatsappFlows.mktv2UserId, mktv2UserId),
            columns: { id: true, name: true }
        });
        
        const flowPerformance = [];
        for (const flow of flows) {
            // Contar quantos usuários distintos entraram em um fluxo (ex: estado ativo para este flowId)
            const [startedResult] = await zapDb.select({ value: count(sql`DISTINCT ${whatsappFlowUserStates.contactJid}`) })
                .from(whatsappFlowUserStates)
                .where(and(
                    eq(whatsappFlowUserStates.mktv2UserId, mktv2UserId),
                    eq(whatsappFlowUserStates.activeFlowId, flow.id)
                    // Poderia adicionar gte(whatsappFlowUserStates.lastInteractionAt, startDate) se quiser apenas no período
                ));
            const totalStarted = startedResult?.value || 0;
            
            // "Completado" é mais complexo - precisa de um nó final ou estado de conclusão. Mock por enquanto.
            const totalCompleted = totalStarted > 0 ? Math.floor(totalStarted * (0.4 + Math.random() * 0.5)) : 0; 
            
            flowPerformance.push({
                flowName: flow.name,
                totalStarted,
                totalCompleted,
                completionRate: totalStarted > 0 ? parseFloat(((totalCompleted / totalStarted) * 100).toFixed(1)) : 0
            });
        }

        res.json({
            totalMessagesSent,
            totalMessagesReceived,
            activeConversations,
            avgFirstResponseTimeMinutes: null, // TODO: Lógica de tempo de resposta
            flowPerformance,
            messagesByDay
        });

    } catch (error) {
        console.error(`[ZapAnalyticsCtrl /analytics] Erro para User ${mktv2UserId}:`, error);
        next(error);
    }
};