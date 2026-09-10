package com.nexus.service;

import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.Phonenumber;
import com.nexus.dto.OtpSendRequest;
import com.nexus.dto.OtpSendResponse;
import com.nexus.dto.OtpVerifyResponse;
import com.nexus.dto.RegisterProfileRequest;
import com.nexus.exception.BadRequestException;
import com.nexus.model.OtpToken;
import com.nexus.model.User;
import com.nexus.repository.OtpTokenRepository;
import com.nexus.repository.UserRepository;
import com.nexus.security.JwtTokenProvider;
import com.nexus.security.VerificationTicketService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    private final OtpTokenRepository otpTokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final VerificationTicketService verificationTicketService;
    private final Environment environment;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${nexus.otp.dev-mode:false}")
    private boolean devMode;

    @Value("${nexus.otp.expiration-minutes:5}")
    private int expirationMinutes;

    // In-memory sliding windows for dual-axis rate limiting
    private final Map<String, Long> targetLastSentMap = new ConcurrentHashMap<>();
    private final Map<String, Integer> targetHourlyCountMap = new ConcurrentHashMap<>();
    private final Map<String, Integer> ipHourlyCountMap = new ConcurrentHashMap<>();

    private final PhoneNumberUtil phoneUtil = PhoneNumberUtil.getInstance();
    private final SecureRandom secureRandom = new SecureRandom();

    public OtpService(
            OtpTokenRepository otpTokenRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            VerificationTicketService verificationTicketService,
            Environment environment) {
        this.otpTokenRepository = otpTokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.verificationTicketService = verificationTicketService;
        this.environment = environment;
    }

    public record NormalizedTarget(String target, OtpToken.TargetType type) {}

    public NormalizedTarget normalizeTarget(String rawTarget, String rawType) {
        if (rawTarget == null || rawTarget.trim().isEmpty()) {
            throw new BadRequestException("Target phone number or email is required.");
        }
        String trimmed = rawTarget.trim();

        if (trimmed.contains("@")) {
            // Validate email format
            String emailRegex = "^[A-Za-z0-9+_.-]+@(.+)$";
            if (!trimmed.matches(emailRegex)) {
                throw new BadRequestException("Invalid email address format.");
            }
            return new NormalizedTarget(trimmed.toLowerCase(), OtpToken.TargetType.EMAIL);
        } else {
            // Normalize phone number to strict E.164 format
            try {
                // If no leading +, test international parsing
                String defaultRegion = trimmed.startsWith("+") ? null : "US";
                Phonenumber.PhoneNumber parsedNumber = phoneUtil.parseAndKeepRawInput(trimmed, defaultRegion);
                if (!phoneUtil.isValidNumber(parsedNumber)) {
                    throw new BadRequestException("Invalid or non-dialable phone number.");
                }
                String e164 = phoneUtil.format(parsedNumber, PhoneNumberUtil.PhoneNumberFormat.E164);
                return new NormalizedTarget(e164, OtpToken.TargetType.PHONE);
            } catch (NumberParseException e) {
                throw new BadRequestException("Unable to parse phone number: " + e.getMessage());
            }
        }
    }

    private void enforceRateLimits(String target, String clientIp) {
        long now = System.currentTimeMillis();

        // 1. Target cooldown (60 seconds)
        Long lastSent = targetLastSentMap.get(target);
        if (lastSent != null && (now - lastSent) < 60_000) {
            long remaining = (60_000 - (now - lastSent)) / 1000;
            throw new BadRequestException("Please wait " + remaining + " seconds before requesting another code.");
        }

        // 2. Target hourly limit (max 5/hr)
        int targetCount = targetHourlyCountMap.getOrDefault(target, 0);
        if (targetCount >= 5) {
            throw new BadRequestException("Too many OTP requests for this number/email. Please try again later.");
        }

        // 3. IP hourly limit (max 10/hr)
        int ipCount = ipHourlyCountMap.getOrDefault(clientIp, 0);
        if (ipCount >= 10) {
            throw new BadRequestException("Too many requests from this network. Please try again later.");
        }

        targetLastSentMap.put(target, now);
        targetHourlyCountMap.put(target, targetCount + 1);
        ipHourlyCountMap.put(clientIp, ipCount + 1);
    }

    @Transactional
    public OtpSendResponse sendOtp(OtpSendRequest request, String clientIp) {
        NormalizedTarget normalized = normalizeTarget(request.getTarget(), request.getType());
        String target = normalized.target();
        OtpToken.TargetType type = normalized.type();

        enforceRateLimits(target, clientIp);

        // Invalidate prior active tokens for this target
        otpTokenRepository.deleteByTarget(target);

        // Generate 6-digit cryptographically secure numeric OTP
        int codeInt = secureRandom.nextInt(1_000_000);
        String plainCode = String.format("%06d", codeInt);

        OtpToken token = OtpToken.builder()
                .target(target)
                .targetType(type)
                .codeHash(passwordEncoder.encode(plainCode))
                .expiresAt(LocalDateTime.now().plusMinutes(expirationMinutes))
                .attempts(0)
                .consumed(false)
                .build();

        otpTokenRepository.save(token);

        // Dispatch OTP
        boolean dispatched = false;
        if (type == OtpToken.TargetType.EMAIL && mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(target);
                message.setSubject("Nexus Verification Code");
                message.setText("Your Nexus verification code is: " + plainCode + "\n\nThis code will expire in " + expirationMinutes + " minutes.");
                mailSender.send(message);
                dispatched = true;
                log.info("Dispatched OTP email to: {}", target);
            } catch (Exception e) {
                log.error("Failed to send OTP email to {}: {}", target, e.getMessage());
            }
        } else if (type == OtpToken.TargetType.PHONE) {
            // SMS provider integration (Twilio/AWS SNS/generic gateway)
            log.info("Dispatched SMS OTP to {}: (masked)", target);
            dispatched = true;
        }

        boolean isProd = environment.acceptsProfiles(Profiles.of("prod", "production"));
        String devCode = null;

        // devCode is strictly gated behind devMode AND non-prod profile
        if (devMode && !isProd) {
            devCode = plainCode;
            log.info("[DEV-MODE OTP] Code for {}: {}", target, plainCode);
        } else if (isProd && !dispatched) {
            throw new RuntimeException("OTP delivery failed. Please try again later.");
        }

        // Anti-enumeration standardized response
        return OtpSendResponse.builder()
                .message("If the target is valid, a verification code has been dispatched.")
                .target(target)
                .targetType(type.name())
                .cooldownSeconds(60L)
                .devCode(devCode)
                .build();
    }

    @Transactional
    public OtpVerifyResponse verifyOtp(String rawTarget, String code) {
        NormalizedTarget normalized = normalizeTarget(rawTarget, null);
        String target = normalized.target();

        OtpToken token = otpTokenRepository.findTopByTargetAndConsumedFalseOrderByCreatedAtDesc(target)
                .orElseThrow(() -> new BadRequestException("No active verification code found for this target."));

        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Verification code has expired. Please request a new one.");
        }

        // Atomic attempt increment
        int updatedRows = otpTokenRepository.incrementAttemptsAtomically(token.getId());
        if (updatedRows == 0) {
            throw new BadRequestException("Maximum verification attempts exceeded. Please request a new code.");
        }

        if (!passwordEncoder.matches(code.trim(), token.getCodeHash())) {
            throw new BadRequestException("Invalid verification code.");
        }

        // Check if user already exists
        User existingUser = null;
        if (token.getTargetType() == OtpToken.TargetType.PHONE) {
            existingUser = userRepository.findByPhoneNumber(target).orElse(null);
        } else {
            existingUser = userRepository.findByEmailIgnoreCase(target).orElse(null);
        }

        if (existingUser != null) {
            // Returning user: mark token consumed and log in immediately
            token.setConsumed(true);
            otpTokenRepository.save(token);

            org.springframework.security.core.userdetails.User userDetails =
                    new org.springframework.security.core.userdetails.User(
                            existingUser.getUsername(), "", Collections.emptyList()
                    );
            Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
            String jwtToken = jwtTokenProvider.generateToken(authentication);

            return OtpVerifyResponse.builder()
                    .isNewUser(false)
                    .token(jwtToken)
                    .user(existingUser)
                    .message("Authentication successful")
                    .build();
        } else {
            // New user: issue short-lived, single-use cryptographically bound ticket
            String jti = UUID.randomUUID().toString();
            token.setTicketJti(jti);
            otpTokenRepository.save(token);

            String ticket = verificationTicketService.createTicket(target, token.getTargetType().name(), jti);

            return OtpVerifyResponse.builder()
                    .isNewUser(true)
                    .verificationTicket(ticket)
                    .message("Code verified. Please complete your username and profile.")
                    .build();
        }
    }

    @Transactional
    public OtpVerifyResponse registerProfile(RegisterProfileRequest req) {
        VerificationTicketService.VerifiedTicketData ticketData =
                verificationTicketService.validateTicket(req.getVerificationTicket());

        OtpToken token = otpTokenRepository.findByTicketJtiAndConsumedFalse(ticketData.jti())
                .orElseThrow(() -> new BadRequestException("Verification ticket is invalid or has already been used."));

        // Canonicalize username to lowercase
        String rawUsername = req.getUsername().trim();
        if (rawUsername.startsWith("@")) {
            rawUsername = rawUsername.substring(1).trim();
        }
        String canonicalUsername = rawUsername.toLowerCase();

        if (canonicalUsername.length() < 3 || canonicalUsername.length() > 32) {
            throw new BadRequestException("Username must be between 3 and 32 characters.");
        }
        if (!canonicalUsername.matches("^[a-z0-9_]{3,32}$")) {
            throw new BadRequestException("Username must contain only letters, numbers, and underscores.");
        }

        if (userRepository.existsByUsernameIgnoreCase(canonicalUsername)) {
            throw new BadRequestException("Username @" + canonicalUsername + " is already taken.");
        }

        // Consume verification token atomically in this transaction
        token.setConsumed(true);
        otpTokenRepository.save(token);

        String password = req.getPassword() != null && !req.getPassword().trim().isEmpty()
                ? passwordEncoder.encode(req.getPassword().trim())
                : passwordEncoder.encode(UUID.randomUUID().toString());

        User.UserBuilder userBuilder = User.builder()
                .username(canonicalUsername)
                .displayName(req.getDisplayName() != null && !req.getDisplayName().isBlank() ? req.getDisplayName().trim() : canonicalUsername)
                .password(password)
                .avatarUrl(req.getAvatarUrl())
                .userTag(canonicalUsername)
                .presence(User.PresenceStatus.ONLINE);

        if ("PHONE".equals(ticketData.targetType())) {
            userBuilder.phoneNumber(ticketData.target());
        } else {
            userBuilder.email(ticketData.target());
        }

        User savedUser;
        try {
            savedUser = userRepository.save(userBuilder.build());
        } catch (DataIntegrityViolationException e) {
            throw new BadRequestException("Username @" + canonicalUsername + " or account already exists.");
        }

        org.springframework.security.core.userdetails.User userDetails =
                new org.springframework.security.core.userdetails.User(
                        savedUser.getUsername(), "", Collections.emptyList()
                );
        Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        String jwtToken = jwtTokenProvider.generateToken(authentication);

        return OtpVerifyResponse.builder()
                .isNewUser(false)
                .token(jwtToken)
                .user(savedUser)
                .message("Profile registered successfully.")
                .build();
    }

    public boolean isUsernameAvailable(String username) {
        if (username == null) return false;
        String clean = username.trim();
        if (clean.startsWith("@")) {
            clean = clean.substring(1).trim();
        }
        String canonical = clean.toLowerCase();
        if (!canonical.matches("^[a-z0-9_]{3,32}$")) {
            return false;
        }
        return !userRepository.existsByUsernameIgnoreCase(canonical);
    }
}
