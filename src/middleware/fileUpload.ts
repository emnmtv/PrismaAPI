import multer from 'multer';

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => { // Use `_req` and `_file` to avoid TS warnings
    cb(null, 'uploads/'); // Files will be saved in the uploads folder
  },
  filename: (_req, file, cb) => { // `_req` is unused, but `file` is used
    cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
  },
});

const upload = multer({ storage });

export { upload };
