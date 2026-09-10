package com.nexus.service;

import jakarta.annotation.PostConstruct;
import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.UUID;

@Service
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private Path uploadRoot;
    private Path tempDir;
    private Path permanentDir;
    private final Tika tika = new Tika();
    private final CloudinaryService cloudinaryService;

    @Value("${nexus.storage.type:local}")
    private String storageType;

    public LocalStorageService(
            @Value("${nexus.upload.dir:#{null}}") String uploadDirProperty,
            CloudinaryService cloudinaryService) {
        this.cloudinaryService = cloudinaryService;

        // Default: use /tmp/uploads on containers (Render, Docker) where /app is read-only,
        // or ./uploads for local development
        if (uploadDirProperty == null || uploadDirProperty.isBlank()) {
            String userDir = System.getProperty("user.dir", ".");
            if (userDir.startsWith("/app")) {
                this.uploadRoot = Paths.get("/tmp/uploads");
            } else {
                this.uploadRoot = Paths.get(userDir, "uploads").normalize().toAbsolutePath();
            }
        } else {
            Path rawPath = Paths.get(uploadDirProperty);
            if (!rawPath.isAbsolute()) {
                this.uploadRoot = Paths.get(System.getProperty("user.dir", ".")).resolve(rawPath).normalize().toAbsolutePath();
            } else {
                this.uploadRoot = rawPath.normalize().toAbsolutePath();
            }
        }

        this.tempDir = this.uploadRoot.resolve("temp");
        this.permanentDir = this.uploadRoot.resolve("permanent");
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(tempDir);
            Files.createDirectories(permanentDir);
            log.info("Initialized local storage at: {}", uploadRoot);
        } catch (Exception e) {
            log.warn("Could not create upload dirs at {}, trying temp directory fallback: {}", uploadRoot, e.getMessage());
            try {
                Path fallback = Paths.get(System.getProperty("java.io.tmpdir", "/tmp"), "uploads");
                this.uploadRoot = fallback;
                this.tempDir = fallback.resolve("temp");
                this.permanentDir = fallback.resolve("permanent");
                Files.createDirectories(this.tempDir);
                Files.createDirectories(this.permanentDir);
                log.info("Initialized local storage at fallback: {}", fallback);
            } catch (Exception fallbackEx) {
                throw new RuntimeException("Could not initialize upload directories: " + uploadRoot + " or fallback", fallbackEx);
            }
        }
    }

    @Override
    public StoredFile uploadTemp(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file.");
        }

        String originalFilename = file.getOriginalFilename();
        String safeExtension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            safeExtension = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
            // Sanitize extension: only alphanumeric
            safeExtension = safeExtension.replaceAll("[^a-z0-9.]", "");
        }

        // Sniff real MIME type via magic bytes
        String detectedMimeType;
        try (InputStream is = file.getInputStream()) {
            detectedMimeType = tika.detect(is, originalFilename);
        } catch (Exception e) {
            detectedMimeType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        }

        String uniqueFilename = UUID.randomUUID().toString() + safeExtension;
        Path targetPath = tempDir.resolve(uniqueFilename).normalize();

        // Enforce path traversal protection
        if (!targetPath.startsWith(tempDir)) {
            throw new SecurityException("Invalid target file path.");
        }

        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        String fileUrl = "/api/files/temp/" + uniqueFilename;
        return new StoredFile(fileUrl, originalFilename != null ? originalFilename : uniqueFilename, detectedMimeType, file.getSize());
    }

    @Override
    public String promote(String tempFileUrlOrName) throws IOException {
        if (tempFileUrlOrName == null || tempFileUrlOrName.trim().isEmpty()) {
            return tempFileUrlOrName;
        }

        // Extract filename from URL or path
        String filename = tempFileUrlOrName;
        int lastSlash = filename.lastIndexOf('/');
        if (lastSlash >= 0) {
            filename = filename.substring(lastSlash + 1);
        }

        // Sanitize to prevent path traversal
        filename = Paths.get(filename).getFileName().toString();

        Path sourceTemp = tempDir.resolve(filename).normalize();
        Path targetPermanent = permanentDir.resolve(filename).normalize();

        if (!sourceTemp.startsWith(tempDir) || !targetPermanent.startsWith(permanentDir)) {
            throw new SecurityException("Invalid path for promotion.");
        }

        if (!Files.exists(sourceTemp)) {
            // Already promoted or file missing
            if (Files.exists(targetPermanent)) {
                return "/api/files/permanent/" + filename;
            }
            throw new IOException("Temp file not found for promotion: " + filename);
        }

        try {
            Files.move(sourceTemp, targetPermanent, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(sourceTemp, targetPermanent, StandardCopyOption.REPLACE_EXISTING);
        }

        String permanentUrl = "/api/files/permanent/" + filename;

        // Hybrid storage mode: asynchronously replicate to Cloudinary if enabled
        if ("hybrid".equalsIgnoreCase(storageType) || "cloudinary".equalsIgnoreCase(storageType)) {
            final String safeFilename = filename;
            new Thread(() -> {
                try {
                    cloudinaryService.uploadBytes(Files.readAllBytes(targetPermanent), safeFilename);
                    log.info("Replicated file {} to remote storage.", safeFilename);
                } catch (Exception ex) {
                    log.warn("Remote replication skipped/failed: {}", ex.getMessage());
                }
            }).start();
        }

        return permanentUrl;
    }

    @Override
    public void delete(String fileUrl) {
        if (fileUrl == null) return;
        try {
            String filename = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
            Path p1 = tempDir.resolve(filename);
            Path p2 = permanentDir.resolve(filename);
            Files.deleteIfExists(p1);
            Files.deleteIfExists(p2);
        } catch (Exception e) {
            log.warn("Could not delete file {}: {}", fileUrl, e.getMessage());
        }
    }

    public Path resolveFile(String scope, String filename) {
        String safeName = Paths.get(filename).getFileName().toString();
        Path dir = "permanent".equalsIgnoreCase(scope) ? permanentDir : tempDir;
        Path target = dir.resolve(safeName).normalize();
        if (!target.startsWith(dir) || !Files.exists(target)) {
            return null;
        }
        return target;
    }

    public Path getTempDir() {
        return tempDir;
    }
}
