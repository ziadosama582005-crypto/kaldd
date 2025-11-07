# استخدم Node.js الرسمي
FROM node:18

# أنشئ مجلد للتطبيق
WORKDIR /app

# انسخ ملفات البوت
COPY package*.json ./
COPY . .

# نزّل التبعيات
RUN npm install

# شغّل البوت
CMD ["npm", "start"]
