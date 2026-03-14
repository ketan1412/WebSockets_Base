import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, data) {
    if (socket.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket is not open. Cannot send message.");
        return;
    }
    socket.send(JSON.stringify(data));
}

function broadCast(wss, data) {
    wss.clients.forEach(client => {
        if (client.readyState !== WebSocket.OPEN) return;
        try {
            sendJson(client, data);
        } catch (error) {
           console.warn("Failed to broadcast to one client:", error);
        }
    });
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

        sendJson(socket, { type: "Welcome to the WebSocket server!" });
        
        socket.on("error", console.error);
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
        broadCast(wss, { type: "MatchCreated", data: match });
    }

    return { broadcastMatchCreated };
}