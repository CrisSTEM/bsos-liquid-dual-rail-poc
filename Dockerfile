FROM node:22-bookworm-slim  
  
ENV NODE_ENV=production \  
    PORT=3000 \  
    HOST=0.0.0.0 \  
    npm_config_build_from_source=true  
  
WORKDIR /app  
  
RUN apt-get update && apt-get install -y --no-install-recommends \  
    python3 \  
    make \  
    g++ \  
  && rm -rf /var/lib/apt/lists/*  
  
COPY package*.json ./  
  
RUN npm ci --omit=dev --build-from-source \  
 && node -e "require('sqlite3'); console.log('sqlite3 native binding OK')"  
  
COPY . .  
  
RUN mkdir -p /app/data  
  
EXPOSE 3000  
  
CMD ["npm", "start"]  
