const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// ─── Chunked Upload ───────────────────────────────────────────────────────────
// In-memory store for chunk tracking  { uploadId → { totalChunks, receivedChunks[], fileName } }
const chunkStore = {};

const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(uploadsDir, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    const { uploadId, chunkIndex } = req.body;
    cb(null, `${uploadId}_chunk_${chunkIndex}`);
  },
});
const chunkUpload = multer({ storage: chunkStorage });

// POST /api/upload-chunk  – receives one chunk at a time
app.post('/api/upload-chunk', chunkUpload.single('chunk'), (req, res) => {
  const { uploadId, chunkIndex, totalChunks, fileName } = req.body;

  if (!chunkStore[uploadId]) {
    chunkStore[uploadId] = { totalChunks: parseInt(totalChunks), received: 0, fileName };
  }
  chunkStore[uploadId].received += 1;

  // All chunks received → reassemble
  if (chunkStore[uploadId].received === chunkStore[uploadId].totalChunks) {
    const finalFileName = `${uploadId}_${fileName}`;
    const finalPath = path.join(uploadsDir, finalFileName);
    const writeStream = fs.createWriteStream(finalPath);

    const tmpDir = path.join(uploadsDir, 'tmp');
    for (let i = 0; i < parseInt(totalChunks); i++) {
      const chunkPath = path.join(tmpDir, `${uploadId}_chunk_${i}`);
      const data = fs.readFileSync(chunkPath);
      writeStream.write(data);
      fs.unlinkSync(chunkPath); // clean up
    }
    writeStream.end();
    delete chunkStore[uploadId];

    return res.json({
      done: true,
      message: 'تم رفع الملف بنجاح',
      url: `/uploads/${finalFileName}`,
    });
  }

  res.json({ done: false, received: chunkStore[uploadId].received });
});

// ─── Submit Property Request ──────────────────────────────────────────────────
const submissionsFile = path.join(__dirname, 'submissions.json');

app.post('/api/submit-property', (req, res) => {
  const { name, phone, type, description, fileUrls } = req.body;

  let submissions = [];
  if (fs.existsSync(submissionsFile)) {
    submissions = JSON.parse(fs.readFileSync(submissionsFile, 'utf-8'));
  }

  const entry = {
    id: uuidv4(),
    date: new Date().toISOString(),
    name,
    phone,
    type,
    description,
    fileUrls: fileUrls || [],
  };
  submissions.push(entry);
  fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));

  res.json({ success: true, message: 'تم استلام طلبك، سنتواصل معك قريباً!' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
