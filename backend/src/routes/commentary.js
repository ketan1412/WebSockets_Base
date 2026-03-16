import { Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { createCommentarySchema, listCommentaryQuerySchema } from "../validation/commentary.js";
import { eq, desc } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get('/', async (req, res) => {
    try {
        const paramResult = matchIdParamSchema.safeParse(req.params);
        const query = listCommentaryQuerySchema.safeParse(req.query);

        if (!paramResult.success) {
            return res.status(400).json({ error: 'Invalid match ID' });
        }

        if (!query.success) {
            return res.status(400).json({ error: 'Invalid query parameters' });
        }

        const limit = query.data.limit ?? 100;
        const safeLimit = Math.min(limit, 100); // Enforce a maximum limit to prevent abuse

        const result = await db.select().from(commentary).where(eq(commentary.matchId, paramResult.data.id)).orderBy(desc(commentary.createdAt)).limit(safeLimit);

        res.status(200).json(result);
    } catch (error) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: error.issues });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

commentaryRouter.post('/', async (req, res) => {
    try {
        const ParamResult = matchIdParamSchema.safeParse(req.params);
        const body = createCommentarySchema.safeParse(req.body);

        if (!ParamResult.success) {
            return res.status(400).json({ error: 'Invalid match ID' });
        }

        if (!body.success) {
            return res.status(400).json({ error: 'Invalid commentary data' });
        }

        const result = await db.insert(commentary).values({
            matchId: ParamResult.data.id,
            minute: body.data.minute,
            sequence: body.data.sequence,
            period: body.data.period,
            eventType: body.data.eventType,
            actor: body.data.actor,
            team: body.data.team,
            message: body.data.message,
            metadata: body.data.metadata,
            tags: body.data.tags,
        }).returning();

        if (res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(ParamResult.data.id, result[0]);
        }

        res.status(201).json(result[0]);
    } catch (error) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: error.issues });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});