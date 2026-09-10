package com.nexus.controller;

import com.nexus.service.LocalStorageService;
import org.apache.tika.Tika;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.file.Path;
import java.util.Set;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final LocalStorageService localStorageService;
    private final Tika tika = new Tika();

    private static final Set<String> INLINE_MEDIA_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4", "video/webm", "video/ogg",
            "audio/mpeg", "audio/ogg", "audio/wav", "audio/aac", "audio/mp4", "audio/webm"
    );

    public FileController(LocalStorageService localStorageService) {
        this.localStorageService = localStorageService;
    }

    @GetMapping("/{scope}/{filename}")
    public ResponseEntity<Resource> getFile(
            @PathVariable String scope,
            @PathVariable String filename) {
        
        Path filePath = localStorageService.resolveFile(scope, filename);
        if (filePath == null) {
            return ResponseEntity.notFound().build();
        }

        File file = filePath.toFile();
        Resource resource = new FileSystemResource(file);

        String mimeType;
        try {
            mimeType = tika.detect(file);
        } catch (Exception e) {
            mimeType = "application/octet-stream";
        }

        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Content-Type-Options", "nosniff");

        // Stored-XSS defense: only verified safe raster images, video, and audio are served inline.
        // All SVG, HTML, scripts, PDF, and general documents are forced attachment download.
        if (INLINE_MEDIA_TYPES.contains(mimeType.toLowerCase())) {
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"");
        } else {
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        }

        return ResponseEntity.ok()
                .headers(headers)
                .contentLength(file.length())
                .contentType(MediaType.parseMediaType(mimeType))
                .body(resource);
    }
}
