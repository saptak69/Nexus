package com.nexus.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@Service
public class CloudinaryService {

    private final Cloudinary cloudinary;

    public CloudinaryService(Cloudinary cloudinary) {
        this.cloudinary = cloudinary;
    }

    public Map<?, ?> upload(MultipartFile file) throws IOException {
        return cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                "resource_type", "auto"
        ));
    }

    public Map<?, ?> uploadBytes(byte[] bytes, String filename) throws IOException {
        return cloudinary.uploader().upload(bytes, ObjectUtils.asMap(
                "public_id", filename,
                "resource_type", "auto"
        ));
    }
}
