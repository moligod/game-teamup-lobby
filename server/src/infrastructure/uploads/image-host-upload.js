const multer = require('multer');

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENT_IMAGE_UPLOADS = 2;
const guardedMulterMethods = ['single', 'array', 'fields', 'none', 'any'];

function positiveInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createUploadBulkhead(maxConcurrent = DEFAULT_MAX_CONCURRENT_IMAGE_UPLOADS) {
    const capacity = positiveInteger(maxConcurrent, DEFAULT_MAX_CONCURRENT_IMAGE_UPLOADS);
    let active = 0;

    function tryAcquire() {
        if (active >= capacity) return null;
        active += 1;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            active = Math.max(0, active - 1);
        };
    }

    function wrap(parser) {
        return (req, res, next) => {
            const release = tryAcquire();
            if (!release) {
                return res.status(503).json({ error: 'Image upload capacity is temporarily full' });
            }

            const releaseOnce = () => {
                res.removeListener?.('finish', releaseOnce);
                res.removeListener?.('close', releaseOnce);
                req.removeListener?.('aborted', releaseOnce);
                release();
            };
            res.once('finish', releaseOnce);
            res.once('close', releaseOnce);
            req.once?.('aborted', releaseOnce);

            parser(req, res, (error) => {
                if (error) {
                    releaseOnce();
                    next(error);
                    return;
                }
                next();
            });
        };
    }

    return {
        wrap,
        activeCount: () => active,
        capacity
    };
}

function createImageUpload({
    maxConcurrentUploads = process.env.IMAGE_UPLOAD_MAX_CONCURRENCY
} = {}) {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: MAX_IMAGE_SIZE, files: 4 },
        fileFilter(req, file, callback) {
            const allowed = /^image\/(avif|gif|jpeg|png|webp)$/i.test(file.mimetype);
            callback(allowed ? null : new Error('Only AVIF, GIF, JPEG, PNG, and WebP images are allowed'), allowed);
        }
    });
    const bulkhead = createUploadBulkhead(maxConcurrentUploads);
    const guardedUpload = {};
    for (const method of guardedMulterMethods) {
        guardedUpload[method] = (...args) => bulkhead.wrap(upload[method](...args));
    }
    return guardedUpload;
}

module.exports = {
    createImageUpload,
    createUploadBulkhead,
    DEFAULT_MAX_CONCURRENT_IMAGE_UPLOADS,
    MAX_IMAGE_SIZE
};
