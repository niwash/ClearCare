# The API image. infra/deploy/compose.yaml builds it on the VM.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /build
# The wrapper and pom.xml first, so the downloaded dependencies stay cached
# until one of them changes.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -q dependency:go-offline
COPY src src
# The tests need Docker, so they run in the checks, not here.
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
RUN useradd --system clearcare-api
COPY --from=build /build/target/api-*.jar /app/api.jar
USER clearcare-api
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/api.jar"]
