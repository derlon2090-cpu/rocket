FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY analyzer/requirements.txt ./analyzer/requirements.txt
RUN python3 -m venv /opt/whisper && /opt/whisper/bin/pip install --no-cache-dir -r analyzer/requirements.txt
ENV PYTHON_BIN=/opt/whisper/bin/python
ENV PORT=3000
ENV HOST=0.0.0.0
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm","start"]
