package ie.clearcare.api.alerts;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import ie.clearcare.api.DatabaseImage;

/**
 * A deployment with no shared token keeps working as it did: the alert routes answer 503 rather than
 * refusing every request with a 401 that would tell the site nothing (ADR-0034).
 *
 * <p>The secret the links are signed with is left out too, so a link cannot be verified either.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AlertNotConfiguredTest {

  private static final String ACCOUNT = "X-ClearCare-Sub";
  private static final String TOKEN = "X-ClearCare-Token";
  private static final String SUB = "1f2e3d4c-0000-4000-8000-000000000201";

  private static final Path REPOSITORY = Path.of("..");
  private static final String PASSWORD = UUID.randomUUID().toString();
  private static final List<String> MIGRATIONS =
      List.of(
          "db/V1__register_entries.sql",
          "db/V15__user_preferences.sql",
          "db/V25__county.sql",
          "db/V26__alert_system.sql");

  @Container static final PostgreSQLContainer database = DatabaseImage.newDatabase(PASSWORD);

  @DynamicPropertySource
  static void connectAsTheApi(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", database::getJdbcUrl);
    registry.add("spring.datasource.password", () -> PASSWORD);
  }

  @Autowired private MockMvc mvc;

  @BeforeAll
  static void createTheSchema() throws Exception {
    for (String migration : MIGRATIONS) {
      try (var connection =
              java.sql.DriverManager.getConnection(
                  database.getJdbcUrl(), database.getUsername(), database.getPassword());
          var statement = connection.createStatement()) {
        statement.execute(
            "SET ROLE clearcare_owner;\n" + Files.readString(REPOSITORY.resolve(migration)));
      }
    }
  }

  @Test
  void answersUnavailableWithoutAToken() throws Exception {
    mvc.perform(get("/alerts").header(ACCOUNT, SUB).header(TOKEN, "any"))
        .andExpect(status().isServiceUnavailable());
    mvc.perform(put("/alerts/all").header(ACCOUNT, SUB).header(TOKEN, "any"))
        .andExpect(status().isServiceUnavailable());
  }
}
