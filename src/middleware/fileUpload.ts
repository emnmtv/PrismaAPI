import multer from 'multer';
import path from 'path';

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Different destinations based on file type
    if (_file.fieldname === 'portfolioFile' || _file.fieldname === 'resumeFile') {
      cb(null, 'uploads/documents/');
    } else if (_file.fieldname === 'audio') {
      cb(null, 'uploads/audio/');
    } else {
      cb(null, 'uploads/');
    }
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter function
const fileFilter = (_req: any, file: any, cb: any) => {
  if (file.fieldname === 'portfolioFile') {
    // Allow PDF and common image formats for portfolio
    if (file.mimetype === 'application/pdf' || 
        file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Portfolio must be PDF or image file'), false);
    }
  } else if (file.fieldname === 'resumeFile') {
    // Allow only PDF and DOC files for resume
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Resume must be PDF or DOC file'), false);
    }
  } else if (file.fieldname === 'audio') {
    // Allow common audio formats
    if (file.mimetype === 'audio/mpeg' || // MP3
        file.mimetype === 'audio/wav' ||
        file.mimetype === 'audio/ogg' ||
        file.mimetype === 'audio/flac' ||
        file.mimetype === 'audio/x-m4a' || // AAC
        file.mimetype === 'audio/mp4' ||
        file.mimetype === 'audio/aac') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV, OGG, FLAC, AAC) are allowed'), false);
    }
  } else {
    // For other files (like images and videos), accept all
    cb(null, true);
  }
};

// Define file size limits for different file types
const limits = {
  fileSize: 300 * 1024 * 1024, // 300MB general limit
};

// Create a specific upload configuration for audio files
const audioUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for audio files
  },
});

// Standard upload configuration for other files
const standardUpload = multer({
  storage,
  fileFilter,
  limits,
});

// Function to select the right upload configuration based on field name
const upload = {
  fields: (fields: { name: string, maxCount?: number }[]) => {
    // Check if any field is for audio
    const hasAudioField = fields.some(field => field.name === 'audio');
    
    // If uploading audio, use the more restrictive size limit
    if (hasAudioField) {
      return audioUpload.fields(fields);
    }
    
    // Otherwise use standard upload
    return standardUpload.fields(fields);
  },
  single: (fieldName: string) => {
    if (fieldName === 'audio') {
      return audioUpload.single(fieldName);
    }
    return standardUpload.single(fieldName);
  },
  // Add other methods (array, none, any) if needed
};

export { upload };
