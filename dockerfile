


FROM node:18-slim

# Install FFmpeg and all debugging tools (including tcpdump)
RUN set -x && \
    apt-get update && \
    apt-get install -y \
      ffmpeg \
      iproute2 \
      net-tools \
      procps \
      iputils-ping \
      netcat-openbsd \
      curl \
      python3 python3-pip \
      tcpdump && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy app files
COPY package.json .



COPY index.js .
COPY public public

# Install dependencies and optionally build frontend
RUN npm install
RUN npm run build || echo "Skipping build (optional)"

# Expose ports
EXPOSE 4000               
EXPOSE 40000-40100/udp      
EXPOSE 40000-40100/tcp      
EXPOSE 5004/udp    
EXPOSE 3000         

# Start the app
CMD ["node", "index.js"]





