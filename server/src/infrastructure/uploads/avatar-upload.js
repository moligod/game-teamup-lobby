const multer = require('multer');
const path = require('path');

function createAvatarUpload(uploadDir) {
    const storage = multer.diskStorage({
        destination(req, file, callback) {
            callback(null, uploadDir);
        },
        filename(req, file, callback) {
            const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            callback(null, `avatar-${suffix}${path.extname(file.originalname)}`);
        }
    });

    return multer({
        storage,
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter(req, file, callback) {
            callback(file.mimetype.startsWith('image/') ? null : new Error('只允许上传图片文件'), file.mimetype.startsWith('image/'));
        }
    });
}

module.exports = { createAvatarUpload };
