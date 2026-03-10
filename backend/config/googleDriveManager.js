// backend/config/googleDriveManager.js
const { google } = require('googleapis');
const { Readable } = require('stream');

const FOLDER_ID = '1GJgizmILNZBGfli7tSC69VR3GJiXQjDi';

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

const MIME_GOOGLE = {
  xlsx: 'application/vnd.google-apps.spreadsheet',
  xls:  'application/vnd.google-apps.spreadsheet',
  xlsm: 'application/vnd.google-apps.spreadsheet',
  docx: 'application/vnd.google-apps.document',
  doc:  'application/vnd.google-apps.document',
  pptx: 'application/vnd.google-apps.presentation',
  ppt:  'application/vnd.google-apps.presentation',
};

const MIME_ORIGINAL = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt:  'application/vnd.ms-powerpoint',
  pdf:  'application/pdf',
};

const MIME_EXPORT = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt:  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

async function subirADrive(buffer, nombre, ext) {
  const drive = getDriveClient();
  const mimeOriginal = MIME_ORIGINAL[ext] || 'application/octet-stream';
  const mimeGoogle   = MIME_GOOGLE[ext];
  const stream = Readable.from(buffer);

  const resp = await drive.files.create({
    requestBody: {
      name:    nombre,
      parents: [FOLDER_ID],
      ...(mimeGoogle && { mimeType: mimeGoogle }),
    },
    media: { mimeType: mimeOriginal, body: stream },
    fields: 'id, webViewLink, mimeType',
  });

  const fileId = resp.data.id;

  let editLink = resp.data.webViewLink;
  if (mimeGoogle) {
    if (mimeGoogle.includes('spreadsheet'))       editLink = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
    else if (mimeGoogle.includes('document'))     editLink = `https://docs.google.com/document/d/${fileId}/edit`;
    else if (mimeGoogle.includes('presentation')) editLink = `https://docs.google.com/presentation/d/${fileId}/edit`;
  }

  return { fileId, webViewLink: editLink, esEditable: !!mimeGoogle };
}

async function descargarDeDrive(fileId, ext) {
  const drive = getDriveClient();
  const mimeExport = MIME_EXPORT[ext];

  let response;
  if (mimeExport) {
    response = await drive.files.export(
      { fileId, mimeType: mimeExport },
      { responseType: 'arraybuffer' }
    );
  } else {
    response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
  }
  return Buffer.from(response.data);
}

async function eliminarDeDrive(fileId) {
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
  } catch(e) {
    console.warn('No se pudo eliminar archivo de Drive:', e.message);
  }
}

module.exports = { subirADrive, descargarDeDrive, eliminarDeDrive };