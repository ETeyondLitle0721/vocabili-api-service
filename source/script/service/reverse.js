import express from "express";
import { WebSocketServer } from "ws";
import * as uuid from "uuid";

const APP_PORT = 63003, WS_PORT = 63002;

const server = {
    "websocket": new WebSocketServer(
        { "host": "127.0.0.1", "port": WS_PORT }
    )
};

const clients = new Set();

server.websocket.on("listening", () => {
    console.log("WebSocket Server is listening" +
        " on ws://127.0.0.1:" + WS_PORT);
});

server.websocket.on("error", (error) => {
    console.error("WebSocket Server Error:", error);
});

function generate_request_id() {
    return uuid.v4();
}

async function broadcast(request) {
    const content = JSON.stringify(request);

    clients.forEach((client) => {
        return client.send(content);
    });
}

const responser = new Set();

server.websocket.on("connection", (client) => {
    clients.add(client);

    client.on("message", (message) => {
        const response = JSON.parse(message);

        responser.forEach((handler) => {
            handler.call(client, response);
        });
    });

    client.on("close", () => {
        clients.delete(client);

        console.log("WebSocket Client Disconnected.");
    });

    console.log("WebSocket Client Connected.");
});

const application = express();

function wait_response(request_id, callback) {
    const handler = (response) => {
        if (response.request_id === request_id) {
            responser.delete(handler);

            return callback({
                "status": "success",
                "data": response.data
            });
        }
    };

    responser.add(handler);

    setTimeout(() => {
        responser.delete(handler);

        return callback({
            "status": "failure",
            "reason": "timeout"
        });
    }, 30000);
}

application.use((request, response) => {
    const elements = {
        "method": request.method,
        "path": request.path,
        "params": request.params,
        "headers": request.headers,
        "data": request.data
    };

    const request_id = generate_request_id();

    broadcast({
        "request_id": request_id,
        "metadata": elements,
        "datetime": new Date().toISOString()
    });

    wait_response(request_id, (result) => {
        if (result.status !== "success") {
            return response.status(500);
        }

        response.status(200).json(result.data);
    });
});

function start() {
    server.website = application.listen(APP_PORT, () => {
        console.log("HTTP Server is listening" +
            " on http://127.0.0.1:" + APP_PORT);
    });

    server.website.on("error", (error) => {
        console.error("HTTP Server Error:", error);
    });
}

export default { start };