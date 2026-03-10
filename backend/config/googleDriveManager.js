// backend/config/googleDriveManager.js
// Sube archivos a Google Drive temporalmente para edición con Google Docs/Sheets/Slides

const { google } = require('googleapis');
const { Readable } = require('stream');

// Credenciales de la service account
const CREDENTIALS = {
  type: 'service_account',
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  token_uri: 'https://oauth2.googleapis.com/token',
};

// Carpeta compartida en Drive donde se guardan los archivos temporales
const FOLDER_ID = '1GJgizmILNZBGfli7tSC69VR3GJiXQjDi';

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

// Mapeo de extensión → mimeType de Google para conversión
const MIME_GOOGLE = {
  xlsx: 'application/vnd.google-apps.spreadsheet',
  xls:  'application/vnd.google-apps.spreadsheet',
  xlsm: 'application/vnd.google-apps.spreadsheet',
  docx: 'application/vnd.google-apps.document',
  doc:  'application/vnd.google-apps.document',
  pptx: 'application/vnd.google-apps.presentation',
  ppt:  'application/vnd.google-apps.presentation',
};

// mimeType original del archivo
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

// mimeType de exportación de vuelta a Office
const MIME_EXPORT = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc:  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt:  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/**
 * Sube un buffer a Google Drive, convirtiendo a formato Google si es editable.
 * Retorna el fileId y el link para abrir en el navegador.
 */
async function subirADrive(buffer, nombre, ext) {
  const drive = getDriveClient();
  const mimeOriginal = MIME_ORIGINAL[ext] || 'application/octet-stream';
  const mimeGoogle   = MIME_GOOGLE[ext]; // undefined si es PDF u otro

  const stream = Readable.from(buffer);

  const metadata = {
    name: nombre,
    parents: [FOLDER_ID],
    // Si es editable, convertir a formato Google para poder editar
    ...(mimeGoogle && { mimeType: mimeGoogle }),
  };

  const media = {
    mimeType: mimeOriginal,
    body: stream,
  };

  const resp = await drive.files.create({
    requestBody: metadata,
    media,
    fields: 'id, webViewLink, mimeType',
    supportsAllDrives: true,
  });

  const fileId = resp.data.id;

  // Permiso de escritura para cualquiera con el link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role:               'writer',
      type:               'anyone',
      allowFileDiscovery: false,
    },
    supportsAllDrives: true,
  });

  // Obtener link actualizado
  const file = await drive.files.get({
    fileId,
    fields: 'webViewLink, exportLinks',
    supportsAllDrives: true,
  });

  // Construir el link de EDICIÓN directo según tipo de archivo
  let editLink = file.data.webViewLink; // fallback
  if (mimeGoogle) {
    if (mimeGoogle.includes('spreadsheet')) {
      editLink = `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
    } else if (mimeGoogle.includes('document')) {
      editLink = `https://docs.google.com/document/d/${fileId}/edit`;
    } else if (mimeGoogle.includes('presentation')) {
      editLink = `https://docs.google.com/presentation/d/${fileId}/edit`;
    }
  }

  return {
    fileId,
    webViewLink: editLink,
    esEditable: !!mimeGoogle,
  };
}

/**
 * Descarga el archivo editado de Drive, exportándolo al formato Office original.
 * Retorna un Buffer con el contenido.
 */
async function descargarDeDrive(fileId, ext) {
  const drive = getDriveClient();
  const mimeExport = MIME_EXPORT[ext];

  let response;
  if (mimeExport) {
    // Exportar de formato Google → formato Office
    response = await drive.files.export(
      { fileId, mimeType: mimeExport, supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
  } else {
    // Descargar directamente (PDF, etc.)
    response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
  }

  return Buffer.from(response.data);
}

/**
 * Elimina el archivo de Drive (limpieza después de guardar).
 */
async function eliminarDeDrive(fileId) {
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (e) {
    console.warn('No se pudo eliminar archivo de Drive:', e.message);
  }
}

module.exports = { subirADrive, descargarDeDrive, eliminarDeDrive };