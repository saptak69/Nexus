package com.nexus.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

public interface StorageService {

    record StoredFile(
        String fileUrl,
        String fileName,
        String fileType,
        long fileSize
    ) {}

    StoredFile uploadTemp(MultipartFile file) throws IOException;

    String promote(String tempFileUrlOrName) throws IOException;

    void delete(String fileUrl);
}
