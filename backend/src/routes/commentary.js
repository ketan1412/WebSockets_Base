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
            console.error('Invalid match ID:', paramResult.error.errors);
            return res.status(400).json({ error: 'Invalid match ID', details: paramResult.error.errors });
        }

        if (!query.success) {
            console.error('Invalid query parameters:', query.error.errors);
            return res.status(400).json({ error: 'Invalid query parameters', details: query.error.errors });
        }

        const limit = query.data.limit ?? 100;
        const safeLimit = Math.min(limit, 100); // Enforce a maximum limit to prevent abuse

        const result = await db.select().from(commentary).where(eq(commentary.matchId, paramResult.data.id)).orderBy(desc(commentary.createdAt)).limit(safeLimit);

        res.status(200).json(result);
    } catch (error) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: error.errors });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

commentaryRouter.post('/', async (req, res) => {
    try {
        console.log('Received commentary creation request:', { params: req.params, body: req.body });
        const ParamResult = matchIdParamSchema.safeParse(req.params);
        const body = createCommentarySchema.safeParse(req.body);

        if (!ParamResult.success) {
            console.error('Invalid match ID:', ParamResult);
            return res.status(400).json({ error: 'Invalid match ID', details: ParamResult.error.errors });
        }

        if (!body.success) {
            console.error('Invalid commentary data:', body);
            return res.status(400).json({ error: 'Invalid commentary data', details: body.error.errors });
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
            res.status(400).json({ error: error.errors });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});