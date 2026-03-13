import { WebSocket, WebSocketServer } from "ws";

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

    wss.on("connection", (socket) => {
        sendJson(socket, { type: "Welcome to the WebSocket server!" });
        socket.on("error", console.error);
    });

    function broadcastMatchCreated(match) {
        broadCast(wss, { type: "MatchCreated", data: match });
    }

    return { broadcastMatchCreated };
}