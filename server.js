const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname));

// 🔒 Your Google Drive folder ID (keep as is)
const FOLDER_ID = '1c-F4f1MeABONJI1ec3Pm89wRQI2i_1ie';

// Set up Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
  }
});
const upload = multer({ storage });

// Prepare Google credentials from environment variables
const googleCredentials = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL
};

// Google Drive auth setup with explicit credentials
const auth = new google.auth.GoogleAuth({
  credentials: googleCredentials,
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });

// Upload to Google Drive function remains unchanged
async function uploadToDrive(filePath, mimeType, name) {
  const fileMetadata = {
    name,
    parents: [FOLDER_ID]
  };
  const media = {
    mimeType,
    body: fs.createReadStream(filePath)
  };
  const response = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, webViewLink'
  });
  return response.data;
}

// Love letter submission endpoint remains unchanged
app.post('/loveletter', upload.fields([
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

    // Save a summary file
    const summaryPath = path.join(__dirname, 'uploads', `summary-${Date.now()}.txt`);
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
    fs.writeFileSync(summaryPath, summaryContent);

    const uploads = [];

    // Upload photos
    for (const photo of photoFiles) {
      const uploaded = await uploadToDrive(photo.path, photo.mimetype, photo.originalname);
      uploads.push(uploaded);
    }

    // Upload optional letter file
    if (letterFile) {
      uploads.push(await uploadToDrive(letterFile.path, letterFile.mimetype, letterFile.originalname));
    }

    // Upload summary
    uploads.push(await uploadToDrive(summaryPath, 'text/plain', path.basename(summaryPath)));

    res.json({
      status: 'success',
      message: '💖 Love letter received!',
      driveLinks: uploads.map(f => f.webViewLink)
    });

    // Cleanup local files
    [...photoFiles.map(p => p.path), letterFile?.path, summaryPath]
      .filter(Boolean)
      .forEach(file => fs.unlink(file, () => {}));
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to submit love letter.' });
  }
});

// Grievance submission endpoint remains unchanged
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

    const evidenceFile = req.file;

    // Save summary
    const summaryText = `
💢 Grievance Received 💢

🙋‍♀️ From: ${username}
📖 Complaint: ${complaint}
📂 Category: ${category}
💥 Severity: ${rating}
🔁 Frequency: ${frequency}
🙏 Preferred Apology: ${apology}
    `.trim();

    const grievanceSummaryPath = path.join(__dirname, 'uploads', `grievance-summary-${Date.now()}.txt`);
    fs.writeFileSync(grievanceSummaryPath, summaryText);

    const uploads = [];

    // Upload evidence image if exists
    if (evidenceFile) {
      const uploadedEvidence = await uploadToDrive(evidenceFile.path, evidenceFile.mimetype, evidenceFile.originalname);
      uploads.push(uploadedEvidence);
    }

    // Upload grievance summary
    const uploadedSummary = await uploadToDrive(grievanceSummaryPath, 'text/plain', path.basename(grievanceSummaryPath));
    uploads.push(uploadedSummary);

    res.json({
      status: 'success',
      message: 'Grievance received! 🙇‍♂️',
      driveLinks: uploads.map(f => f.webViewLink)
    });

    // Cleanup
    [evidenceFile?.path, grievanceSummaryPath]
      .filter(Boolean)
      .forEach(file => fs.unlink(file, () => {}));
  } catch (err) {
    console.error('❌ Grievance Error:', err);
    res.status(500).json({ status: 'error', message: 'Grievance submission failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`💌 Love Letter & Grievance Server is running at http://localhost:${PORT}`);
});
