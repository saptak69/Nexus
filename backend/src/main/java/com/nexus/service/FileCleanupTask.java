package com.nexus.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class FileCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(FileCleanupTask.class);
    private final LocalStorageService localStorageService;

    public FileCleanupTask(LocalStorageService localStorageService) {
        this.localStorageService = localStorageService;
    }

    // Run every hour to sweep temporary uploads older than 2 hours
    @Scheduled(cron = "0 0 * * * *")
    public void cleanupAbandonedTempUploads() {
        Path tempDir = localStorageService.getTempDir();
        if (tempDir == null || !Files.exists(tempDir)) {
            return;
        }

        Instant cutoff = Instant.now().minus(2, ChronoUnit.HOURS);
        log.info("Starting sweep of abandoned temp uploads older than: {}", cutoff);

        try (DirectoryStream<Path> stream = Files.newDirectoryStream(tempDir)) {
            int deletedCount = 0;
            for (Path entry : stream) {
                if (Files.isRegularFile(entry)) {
                    BasicFileAttributes attrs = Files.readAttributes(entry, BasicFileAttributes.class);
                    if (attrs.creationTime().toInstant().isBefore(cutoff)) {
                        try {
                            Files.deleteIfExists(entry);
                            deletedCount++;
                        } catch (IOException ex) {
                            log.warn("Failed to delete expired temp file {}: {}", entry.getFileName(), ex.getMessage());
                        }
                    }
                }
            }
            if (deletedCount > 0) {
                log.info("Swept and deleted {} expired temp upload(s).", deletedCount);
            }
        } catch (IOException e) {
            log.error("Error during temp uploads sweep", e);
        }
    }
}
