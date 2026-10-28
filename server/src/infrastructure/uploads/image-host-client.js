const { normalizeTimeoutMs, withAbortTimeout } = require('../http/abort-timeout');

const DEFAULT_IMAGE_HOST_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_IMAGE_HOST_UPLOAD_TIMEOUT_MS = 45_000;

class ImageHostClient {
    constructor({
        getConfig,
        fetchImpl = fetch,
        requestTimeoutMs = process.env.IMAGE_HOST_REQUEST_TIMEOUT_MS,
        uploadTimeoutMs = process.env.IMAGE_HOST_UPLOAD_TIMEOUT_MS
    }) {
        this.getConfig = getConfig;
        this.fetch = fetchImpl;
        this.requestTimeoutMs = normalizeTimeoutMs(requestTimeoutMs, DEFAULT_IMAGE_HOST_REQUEST_TIMEOUT_MS);
        this.uploadTimeoutMs = normalizeTimeoutMs(uploadTimeoutMs, DEFAULT_IMAGE_HOST_UPLOAD_TIMEOUT_MS);
    }

    async getRequiredConfig() {
        const config = await this.getConfig();
        if (!config?.base_url || !config?.api_key) {
            throw new Error('Image host is not configured');
        }
        return config;
    }

    async request(path, { method = 'GET', query, body, headers, signal } = {}) {
        const config = await this.getRequiredConfig();
        const url = new URL(path, config.base_url.endsWith('/') ? config.base_url : `${config.base_url}/`);
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
            }
        }
        return withAbortTimeout({
            timeoutMs: this.requestTimeoutMs,
            label: 'Image host request',
            signal
        }, async (requestSignal) => {
            const response = await this.fetch(url, {
                method,
                headers: { 'X-API-Key': config.api_key, ...headers },
                body,
                signal: requestSignal
            });
            let payload = null;
            try {
                payload = await response.json();
            } catch (error) {
                if (requestSignal.aborted) throw error;
            }
            if (!response.ok) {
                const detail = payload?.message || payload?.msg || payload?.error || response.statusText;
                throw new Error(`Image host request failed (${response.status}): ${detail}`);
            }
            return payload;
        });
    }

    async uploadFiles(files, { folderId, signal } = {}) {
        const config = await this.getRequiredConfig();
        const form = new FormData();
        for (const file of files) {
            if (!Buffer.isBuffer(file?.buffer)) throw new Error('Image upload requires in-memory file data');
            form.append('files', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'image');
            // Blob owns its immutable copy now; release Multer's duplicate reference
            // before waiting on the remote host.
            file.buffer = null;
        }
        if (folderId || config.review_folder_id) form.append('folder_id', folderId || config.review_folder_id);
        return withAbortTimeout({
            timeoutMs: this.uploadTimeoutMs,
            label: 'Image upload',
            signal
        }, async (requestSignal) => {
            const response = await this.fetch(new URL('/api/v1/upload/', config.base_url), {
                method: 'POST',
                headers: { 'X-API-Key': config.api_key },
                body: form,
                signal: requestSignal
            });
            let payload = null;
            try {
                payload = await response.json();
            } catch (error) {
                if (requestSignal.aborted) throw error;
            }
            if (!response.ok || !payload?.success) {
                const detail = payload?.message || payload?.msg || payload?.error || response.statusText;
                throw new Error(`Image upload failed: ${detail || 'unknown error'}`);
            }
            const uploaded = (payload.files || [])
                .filter((file) => typeof file?.url === 'string')
                .map((file) => ({ id: file.id, url: file.url, filename: file.filename, file_size: file.file_size }));
            if (uploaded.length !== files.length) throw new Error('Image host did not accept every uploaded image');
            return uploaded;
        });
    }

    importUrl(source, { categories, filename } = {}) {
        const form = new FormData();
        form.append('src', source);
        if (categories) form.append('categories', categories);
        if (filename) form.append('filename', filename);
        return this.request('/upload', { method: 'POST', body: form });
    }

    listEntries(query) { return this.request('/api/v1/entries/', { query }); }
    listFolders(query) { return this.request('/api/v1/folders/', { query }); }
    createFolder(body) { return this.request('/api/v1/folders/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    deleteFolder(folderId, force = false) { return this.request(`/api/v1/folders/${encodeURIComponent(folderId)}`, { method: 'DELETE', query: { force } }); }
    moveFiles(fileIds, targetFolderId = null) { return this.request('/api/v1/files/batch/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_ids: fileIds, target_folder_id: targetFolderId }) }); }
    deleteFiles(fileIds) { return this.request('/api/v1/files/batch/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_ids: fileIds }) }); }
    restoreFiles(fileIds, folderId = null) { return this.request('/api/v1/trash/files/batch/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_ids: fileIds, folder_id: folderId }) }); }
    permanentlyDeleteFiles(fileIds) { return this.request('/api/v1/trash/files/batch/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_ids: fileIds }) }); }
    restoreFolder(folderId, targetParentId = null) { return this.request(`/api/v1/trash/folders/${encodeURIComponent(folderId)}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_parent_id: targetParentId }) }); }
    permanentlyDeleteFolder(folderId) { return this.request(`/api/v1/trash/folders/${encodeURIComponent(folderId)}/delete`, { method: 'POST' }); }
}

module.exports = {
    ImageHostClient,
    DEFAULT_IMAGE_HOST_REQUEST_TIMEOUT_MS,
    DEFAULT_IMAGE_HOST_UPLOAD_TIMEOUT_MS
};
