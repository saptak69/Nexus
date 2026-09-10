package com.nexus.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
@Profile("!test")
public class DatabaseConfig {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${spring.datasource.url:jdbc:h2:file:./data/nexus_db;DB_CLOSE_DELAY=-1;MODE=PostgreSQL}")
    private String defaultUrl;

    @Value("${spring.datasource.username:sa}")
    private String defaultUsername;

    @Value("${spring.datasource.password:}")
    private String defaultPassword;

    @Bean
    @Primary
    public DataSource dataSource() {
        String dbUrl = System.getenv("DATABASE_URL");
        if (dbUrl == null || dbUrl.isBlank()) {
            dbUrl = System.getenv("DB_URL");
        }
        if (dbUrl == null || dbUrl.isBlank()) {
            dbUrl = defaultUrl;
        }

        HikariConfig config = new HikariConfig();

        // 1. Support standard Render/Heroku DATABASE_URL: postgres://user:password@host/dbname
        if (dbUrl != null && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"))) {
            try {
                String cleanUrl = dbUrl;
                if (cleanUrl.startsWith("postgres://")) {
                    cleanUrl = "postgresql://" + cleanUrl.substring("postgres://".length());
                }
                URI uri = new URI(cleanUrl);
                String host = uri.getHost();
                if (host != null && host.startsWith("dpg-") && !host.contains(".")) {
                    host = host + ".oregon-postgres.render.com";
                }
                int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String path = uri.getPath();

                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + path;
                if (uri.getQuery() != null && !uri.getQuery().isBlank()) {
                    jdbcUrl += "?" + uri.getQuery();
                }

                String username = defaultUsername;
                String password = defaultPassword;
                if (uri.getUserInfo() != null) {
                    String[] userParts = uri.getUserInfo().split(":", 2);
                    username = userParts[0];
                    if (userParts.length > 1) {
                        password = userParts[1];
                    }
                }

                log.info("Configuring PostgreSQL DataSource for host: {}", host);
                config.setJdbcUrl(jdbcUrl);
                config.setUsername(username);
                config.setPassword(password);
                config.setDriverClassName("org.postgresql.Driver");
                return new HikariDataSource(config);
            } catch (Exception e) {
                log.warn("Failed to parse postgres URL as URI, falling back: {}", e.getMessage());
            }
        }

        // 2. Support standard JDBC URLs, with auto-completion for Render internal hostnames
        if (dbUrl != null && dbUrl.startsWith("jdbc:postgresql://")) {
            String jdbcUrl = dbUrl;
            try {
                int hostStart = "jdbc:postgresql://".length();
                int hostEnd = jdbcUrl.indexOf(":", hostStart);
                if (hostEnd == -1) {
                    hostEnd = jdbcUrl.indexOf("/", hostStart);
                }
                if (hostEnd != -1) {
                    String host = jdbcUrl.substring(hostStart, hostEnd);
                    if (host.startsWith("dpg-") && !host.contains(".")) {
                        String fullHost = host + ".oregon-postgres.render.com";
                        jdbcUrl = jdbcUrl.replace(host, fullHost);
                        log.info("Auto-completed Render PostgreSQL host to: {}", fullHost);
                    }
                }
            } catch (Exception ignored) {}

            log.info("Configuring PostgreSQL DataSource with JDBC URL: {}", jdbcUrl);
            config.setJdbcUrl(jdbcUrl);
            config.setUsername(defaultUsername);
            config.setPassword(defaultPassword);
            config.setDriverClassName("org.postgresql.Driver");
            return new HikariDataSource(config);
        }

        // 3. Fallback for local development (H2)
        log.info("Configuring default DataSource: {}", defaultUrl);
        config.setJdbcUrl(defaultUrl);
        config.setUsername(defaultUsername);
        config.setPassword(defaultPassword);
        return new HikariDataSource(config);
    }
}
