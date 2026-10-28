const fs = require('fs');
const path = require('path');

class LocalAvatarStorage {
    constructor(uploadDir) {
        this.uploadDir = uploadDir;
    }

    buildPublicUrl(protocol, host, fileName) {
        return `${protocol}://${host}/uploads/${fileName}`;
    }

    removeUploadedFile(filePath) {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    removePreviousAvatar(avatarUrl, publicUploadsBase) {
        if (!avatarUrl || !avatarUrl.startsWith(publicUploadsBase)) return;
        const fileName = avatarUrl.slice(publicUploadsBase.length);
        if (!fileName.startsWith('avatar-')) return;
        const target = path.resolve(this.uploadDir, fileName);
        const root = path.resolve(this.uploadDir);
        if (path.dirname(target) !== root) return;
        this.removeUploadedFile(target);
    }
}

module.exports = { LocalAvatarStorage };
