const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getDb } = require('../database/db');

// Get storage config
function getStorageConfig() {
    const db = getDb();
    const config = {};
    db.prepare('SELECT * FROM config WHERE key LIKE ?').all('storage_%').forEach(c => {
        config[c.key] = c.value;
    });
    return config;
}

// S3 Client (lazy initialization)
let s3Client = null;
function getS3Client() {
    const config = getStorageConfig();
    if (config.storage_type !== 's3') return null;
    
    if (!s3Client && config.storage_s3_endpoint) {
        s3Client = new S3Client({
            endpoint: config.storage_s3_endpoint,
            region: config.storage_s3_region || 'us-east-1',
            credentials: {
                accessKeyId: config.storage_s3_access_key || '',
                secretAccessKey: config.storage_s3_secret_key || ''
            },
            forcePathStyle: true
        });
    }
    return s3Client;
}

// Local storage configuration
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Allowed extensions
    const allowedExts = ['.zip', '.tar', '.gz', '.7z', '.rar', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff', '.tif', '.heic', '.heif', '.avif', '.py', '.c', '.cpp', '.js', '.html', '.css', '.json', '.xml', '.csv', '.pcap', '.pcapng', '.bin', '.elf', '.exe', '.sh', '.bat', '.ps1', '.rb', '.java', '.go', '.rs', '.md', '.doc', '.docx', '.pptx', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

// Multer upload middleware
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 1024 // 1GB max
    }
});

// Upload file (handles both local and S3)
async function uploadFile(file) {
    const config = getStorageConfig();
    
    if (config.storage_type === 's3') {
        const client = getS3Client();
        if (!client) throw new Error('S3 not configured');
        
        const key = `challenges/${file.filename}`;
        const fileContent = fs.readFileSync(file.path);
        
        await client.send(new PutObjectCommand({
            Bucket: config.storage_s3_bucket,
            Key: key,
            Body: fileContent,
            ContentType: file.mimetype
        }));
        
        // Delete local temp file
        fs.unlinkSync(file.path);
        
        // Return S3 URL
        return `${config.storage_s3_endpoint}/${config.storage_s3_bucket}/${key}`;
    }
    
    // Local storage - return relative path
    return `/uploads/${file.filename}`;
}

// Delete file
async function deleteFile(fileUrl) {
    const config = getStorageConfig();
    
    if (config.storage_type === 's3' && fileUrl.includes(config.storage_s3_endpoint)) {
        const client = getS3Client();
        if (!client) return;
        
        const key = fileUrl.split('/').slice(-2).join('/');
        await client.send(new DeleteObjectCommand({
            Bucket: config.storage_s3_bucket,
            Key: key
        }));
    } else if (fileUrl.startsWith('/uploads/')) {
        const filename = fileUrl.replace('/uploads/', '');
        const filepath = path.join(uploadDir, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    }
}

module.exports = {
    upload,
    uploadFile,
    deleteFile,
    uploadDir
};
