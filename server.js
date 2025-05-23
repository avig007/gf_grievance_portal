const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const cors = require('cors');
const stream = require('stream');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

// Google Drive Folder ID
const FOLDER_ID = '1c-F4f1MeABONJI1ec3Pm89wRQI2i_1ie';

// Use memory storage (no local disk write)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Load Google credentials from environment
const googleCredentials = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL
};

const auth = new google.auth.GoogleAuth({
  credentials: googleCredentials,
  scopes: ['https://www.googleapis.com/auth/drive.file']
});
const drive = google.drive({ version: 'v3', auth });

async function uploadBufferToDrive(buffer, mimeType, name) {
  const media = {
    mimeType,
    body: stream.Readable.from(buffer)
  };
  const fileMetadata = {
    name,
    parents: [FOLDER_ID]
  };
  const res = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, webViewLink'
  });
  return res.data;
}

async function uploadTextToDrive(text, name) {
  const buffer = Buffer.from(text, 'utf-8');
  return uploadBufferToDrive(buffer, 'text/plain', name);
}

// 💌 Love letter endpoint
app.post('https://gf-grievance-portal-1.onrender.com/loveletter', upload.fields([
  { name: 'photos', maxCount: 15 },
  { name: 'letterFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      loveletter,
      q1,
      q1custom,
      kinkyQuestion,
      kinkyQuestionCustom,
      q2,
      q3,
      q3custom
    } = req.body;

    const photoFiles = req.files['photos'] || [];
    const letterFile = req.files['letterFile']?.[0];

    const allQ1 = Array.isArray(q1) ? q1 : (q1 ? [q1] : []);
    if (q1custom) allQ1.push(q1custom);

    const allKinky = Array.isArray(kinkyQuestion) ? kinkyQuestion : (kinkyQuestion ? [kinkyQuestion] : []);
    if (kinkyQuestionCustom) allKinky.push(kinkyQuestionCustom);

    const allQ3 = Array.isArray(q3) ? q3 : (q3 ? [q3] : []);
    if (q3custom) allQ3.push(q3custom);

    const summaryContent = `
💌 Love Letter Received 💌

Letter:
${loveletter}

💄 Best Moments:
${allQ1.join(', ')}

🖤 Safe Word:
${q2}

🔥 In the Mood for:
${allKinky.join(', ')}

🧣 Secret Weapons:
${allQ3.join(', ')}
    `.trim();

    const uploads = [];

    for (const photo of photoFiles) {
      const uploaded = await uploadBufferToDrive(photo.buffer, photo.mimetype, photo.originalname);
      uploads.push(uploaded);
    }

    if (letterFile) {
      uploads.push(await uploadBufferToDrive(letterFile.buffer, letterFile.mimetype, letterFile.originalname));
    }

    uploads.push(await uploadTextToDrive(summaryContent, `love-summary-${Date.now()}.txt`));

    res.json({
      status: 'success',
      message: '💖 Love letter received!',
      driveLinks: uploads.map(f => f.webViewLink)
    });
  } catch (err) {
    console.error('❌ Love Letter Error:', err.message, err.stack);
    res.status(500).json({ status: 'error', message: 'Failed to submit love letter.' });
  }
});

// 💢 Grievance endpoint
app.post('/grievance', upload.single('evidence'), async (req, res) => {
  try {
    const {
      username,
      complaint,
      category,
      rating,
      frequency,
      apology
    } = req.body;

    const summary = `
💢 Grievance Received 💢

🙋‍♀️ From: ${username}
📖 Complaint: ${complaint}
📂 Category: ${category}
💥 Severity: ${rating}
🔁 Frequency: ${frequency}
🙏 Preferred Apology: ${apology}
    `.trim();

    const uploads = [];

    if (req.file) {
      uploads.push(await uploadBufferToDrive(req.file.buffer, req.file.mimetype, req.file.originalname));
    }

    uploads.push(await uploadTextToDrive(summary, `grievance-summary-${Date.now()}.txt`));

    res.json({
      status: 'success',
      message: 'Grievance received! 🙇‍♂️',
      driveLinks: uploads.map(f => f.webViewLink)
    });
  } catch (err) {
    console.error('❌ Grievance Error:', err.message, err.stack);
    res.status(500).json({ status: 'error', message: 'Grievance submission failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
