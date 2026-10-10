FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Port 7860 is the standard port required by Hugging Face Spaces
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

CMD ["node", "server.js"]
