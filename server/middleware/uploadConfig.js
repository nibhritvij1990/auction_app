const multer = require('multer');
const path = require('path');

// 1) Configure the storage location & filename logic
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // "public/uploads" is where files will be physically stored
    // Make sure "public/uploads" folder exists in your project
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: function (req, file, cb) {
    // e.g., "auction-123456789.png"
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '';
    cb(null, 'auction-' + uniqueSuffix + ext);
  }
});

// 2) File filter to accept only image files
function fileFilter(req, file, cb) {
  // “image/xxx” indicates an image MIME type (e.g., image/png, image/jpeg)
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
}

// 3) Multer instance with our storage, fileFilter, and a size limit (2 MB for example)
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB max
});

module.exports = upload;