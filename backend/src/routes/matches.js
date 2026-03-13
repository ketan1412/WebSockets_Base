import { Router } from "express";
import { desc } from "drizzle-orm";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";

export const matchesRouter = Router();

const MAX_LIMIT = 100;

matchesRouter.get("/", async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);
    
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid query parameters.', details: JSON.stringify(parsed.error) });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

    try{
        const matchesList = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);
        res.status(200).json({ data: matchesList });
    }catch(error) {
        return res.status(500).json({ error: 'Failed to fetch matches.' });
    }
});

matchesRouter.post("/", async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);
    
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload.', details: JSON.stringify(parsed.error) });
    }
    
    const { data: { startTime, endTime, homeScore, awayScore } } = parsed;
    
    try {
        const [event] = await db.insert(matches).values({
            ...parsed.data,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        }).returning();

        const broadcastMatchCreated = res.app.locals.broadcastMatchCreated;
        if (typeof broadcastMatchCreated === "function") {
            try {
                broadcastMatchCreated(event);
            } catch (error) {
                console.error("Match created but websocket broadcast failed:", error);
            }
        }

        res.status(201).json({ data: event });

    } catch (error) {
        res.status(500).json({ error: 'Failed to create match.' });
    }
})