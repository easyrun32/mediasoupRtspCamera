import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mediasoup from 'mediasoup';
import path from 'path';

const __dirname = path.resolve();

// ✅ MUST BE YOUR PUBLIC SERVER IP!
const RTP_IP =  process.env.hostip || '127.0.0.1'; // <--- REPLACE THIS with your Vultr server's public IP
console.log("process.env.hostip", process.env.hostip)
const app = express();
const server = http.createServer(app);
const io = new Server(server);

server.listen(4000, () => {
  console.log('✅ Server running at http://0.0.0.0:4000');
});

app.use(express.static(path.join(__dirname, 'public')));

let worker, router;

const cameras = {
  cam1: {
    ssrc: 22222222,
    producer: null,
    transport: null,
  },
  cam2:{
	ssrc: 22222222,
    producer: null,
    transport: null,
  }
};

const startMediasoup = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 40100
  });

  router = await worker.createRouter({
    mediaCodecs: [{
      kind: 'video',
      mimeType: 'video/H264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
      }
    }]
  });

  console.log('✅ Mediasoup Router Created:', router.id);

  for (const [camKey, cam] of Object.entries(cameras)) {
    const transport = await router.createPlainTransport({
      listenIp: { ip: RTP_IP, announcedIp: RTP_IP }, // Binds to public IP
      rtcpMux: false,
      comedia: true
    });

    cam.transport = transport;
    const { localPort } = transport.tuple;

    console.log(`🎯 ${camKey} PlainTransport RTP Port: ${localPort}`);

    const producer = await transport.produce({
      kind: 'video',
      rtpParameters: {
        codecs: [{
          mimeType: 'video/H264',
          payloadType: 100,
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
          }
        }],
        encodings: [{ ssrc: cam.ssrc }]
      }
    });

    cam.producer = producer;

    transport.on('tuple', (tuple) => {
      console.log(`📡 ${camKey} got RTP from: ${tuple.remoteIp}:${tuple.remotePort}`);
    });

    producer.on('score', (score) => {
      console.log(`📈 ${camKey} Producer score:`, score);
    });

    console.log(`🎥 ${camKey} Producer Created: ${producer.id}`);
  }
};

io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);
  socket.emit('connection-success', { socketId: socket.id });

  socket.on('getRtpCapabilities', (callback) => {
    callback({ rtpCapabilities: router.rtpCapabilities });
  });

  socket.on('createWebRtcTransport', async (_, callback) => {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: RTP_IP }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    socket.transport = transport;

    callback({
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });
  });

  socket.on('transport-recv-connect', async ({ dtlsParameters }, callback) => {
    await socket.transport.connect({ dtlsParameters });
    callback();
  });

  socket.on('consume', async ({ rtpCapabilities, camKey }, callback) => {
    const cam = cameras[camKey];
    if (!cam || !cam.producer) return callback({ error: 'Camera not available' });

    if (!router.canConsume({ producerId: cam.producer.id, rtpCapabilities })) {
      return callback({ error: 'Cannot consume' });
    }

    const consumer = await socket.transport.consume({
      producerId: cam.producer.id,
      rtpCapabilities,
      paused: false,
    });

    callback({
      params: {
        id: consumer.id,
        producerId: cam.producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      },
    });
  });

  socket.on('consumer-resume', async (_, callback) => {
    callback(); // optional: await consumer.resume();
  });
});

startMediasoup();



