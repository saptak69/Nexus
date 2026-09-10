# Build stage
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
# Download dependencies first to cache them
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
# Add non-root user for security and create uploads directories with spring ownership
RUN addgroup -S spring && adduser -S spring -G spring && \
    mkdir -p /app/uploads /tmp/uploads && \
    chown -R spring:spring /app /tmp/uploads
USER spring:spring
COPY --from=build --chown=spring:spring /app/target/nexus-*.jar app.jar
EXPOSE 8080
ENV NEXUS_UPLOAD_DIR=/tmp/uploads
ENTRYPOINT ["java", "-jar", "app.jar"]

