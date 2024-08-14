const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const express = require('express');

const app = express();
const port = 3000;
const logFilePath = path.join(__dirname, 'text.txt');
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Function to get the last 'n' lines from the file
function getLastNLines(filePath, n) {
    return new Promise((resolve, reject) => {
        let stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        let lines = [];
        stream.on('data', (chunk) => {
            lines = chunk.split('\n');
        });
        stream.on('end', () => {
            resolve(lines.slice(-n).join('\n'));
        });
        stream.on('error', reject);
    });
}

// Function to monitor the log file and stream updates
function monitorLogFile(ws, lastSize) {
    fs.stat(logFilePath, (err, stats) => {
        if (err) {
            ws.send('Error reading log file');
            return lastSize;
        }

        if (stats.size > lastSize) {
            let stream = fs.createReadStream(logFilePath, { encoding: 'utf8', start: lastSize });
            stream.on('data', (chunk) => {
             //   ws.send(chunk);  // Send only the new content
            });
            return stats.size;  // Update the lastSize to the new file size
        }
        
        return lastSize;  // No update, return the same lastSize
    });
}

// WebSocket connection
wss.on('connection', async (ws) => {
    console.log('Client connected');

    // Send the last 10 lines when a client connects
    try {
        const lastLines = await getLastNLines(logFilePath, 10);
        ws.send(lastLines);
    } catch (error) {
        ws.send('Error retrieving last lines');
    }

    let lastSize = 0;

    // Monitor the log file every second and send updates
    const interval = setInterval(() => {
        lastSize = monitorLogFile(ws, lastSize);
    }, 1000);

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});

// Serve the static client page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
