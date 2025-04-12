const io = require('socket.io-client');
const mediasoupClient = require('mediasoup-client');

const socket = io();
let device, transports = [];

socket.on('connection-success', ({ socketId }) => {
  start();
});

async function start() {
  const rtpCapabilities = await getRtpCapabilities();
  await createDevice(rtpCapabilities);
  await consumeCamera('cam1', 'video1');
  await consumeCamera('cam2', 'video2');
}

async function getRtpCapabilities() {
  return new Promise((resolve) => {
    socket.emit('getRtpCapabilities', (data) => resolve(data.rtpCapabilities));
  });
}

async function createDevice(rtpCapabilities) {
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });
}

async function consumeCamera(camKey, videoElementId) {
  return new Promise((resolve, reject) => {
    socket.emit('createWebRtcTransport', {}, async (data) => {
      if (data.error) return reject(data.error);

      const transport = device.createRecvTransport(data.params);
      transports.push(transport);

      transport.on('connect', ({ dtlsParameters }, callback) => {
        socket.emit('transport-recv-connect', { dtlsParameters }, callback);
      });

      socket.emit('consume', { rtpCapabilities: device.rtpCapabilities, camKey }, async (res) => {
        if (res.error) return reject(res.error);

        const consumer = await transport.consume({
          id: res.params.id,
          producerId: res.params.producerId,
          kind: res.params.kind,
          rtpParameters: res.params.rtpParameters,
        });

        const stream = new MediaStream([consumer.track]);
        document.getElementById(videoElementId).srcObject = stream;

        socket.emit('consumer-resume', {}, resolve);
      });
    });
  });
}
