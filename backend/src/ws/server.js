import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();
const MAX_SUBSCRIPTIONS_PER_SOCKET = 100;

function subscribe(matchId, socket) {
    if(!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if(!subscribers) return;

    subscribers.delete(socket);

    if(subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanupSubscriptions(socket) {
    for(const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

function sendJson(socket, data) {
    if (socket.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket is not open. Cannot send message.");
        return;
    }
    socket.send(JSON.stringify(data));
}

function broadCastToAll(wss, data) {
    wss.clients.forEach(client => {
        if (client.readyState !== WebSocket.OPEN) return;
        try {
            sendJson(client, data);
        } catch (error) {
           console.warn("Failed to broadcast to one client:", error);
        }
    });
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    if(!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for(const client of subscribers) {
        if(client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, { type: 'error', message: 'Invalid JSON' });
        return;
    }

    if(message?.type === "subscribe" && Number.isInteger(message.matchId)) {
        if (socket.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_SOCKET) {
            sendJson(socket, { type: "error", message: "Subscription limit reached" });
            return;
        }
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId });
        return;
    }

    if(message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId });
    }
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1024 * 1024 }); // 1MB max payload

    wss.on("connection", async (socket, req) => {
        if (wsArcjet){
            try{
                const decision = await wsArcjet.protect(req);
                if (decision.isDenied()){
                    const code = decision.reason.isRateLimit() ? 1013 : 1008; // 1013: Try Again Later, 1008: Policy Violation
                    const reason = decision.reason.isRateLimit() ? "Rate limit exceeded" : "Forbidden";
                    socket.close(code, reason);
                    return;
                }
            } catch(error) {
               console.error("Arcjet WebSocket protection error:", error);
               socket.close(1011, "Internal server error");
               return; 
            }
        }
        socket.isAlive = true;
        socket.on("pong", () => { socket.isAlive = true; });

        socket.subscriptions = new Set();

        sendJson(socket, { type: "Welcome to the WebSocket server!" });
        
        socket.on("message", data => handleMessage(socket, data));
        
        socket.on("close", () => cleanupSubscriptions(socket));

        socket.on("error", () => {
            socket.terminate();
            console.error("WebSocket error occurred");
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach(socket => {
            if (!socket.isAlive){
                socket.terminate();
                return;
            }    
            socket.isAlive = false;
            socket.ping();
        })}, 30000);

    wss.on("close", () => clearInterval(interval));

    function broadcastMatchCreated(match) {
        broadCastToAll(wss, { type: "MatchCreated", data: match });
    }

    function broadcastCommentary(matchId, comment) {
        broadcastToMatch(matchId, { type: 'commentary', data: comment });
    }

    return { broadcastMatchCreated, broadcastCommentary };
}