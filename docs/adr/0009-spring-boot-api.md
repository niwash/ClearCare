# The API is written in Java with Spring Boot

The pipeline stays in Python, because the PDF and text libraries we need are Python libraries. The API that serves the website only reads from PostgreSQL (ADR-0008) and uses none of those libraries, so its language is a free choice. We first planned FastAPI, to keep the whole system in one language.

We chose Java with Spring Boot instead. Most of the team knows Java better than Python, and every pull request needs a teammate's approval, so with the API in Java most of us can write and review it while the pipeline moves on in parallel. Spring Boot also has maintained modules for what the API will need: login for the review pages we plan, health checks, database access, and tests against a real PostgreSQL. Spring Boot 4.1 has open-source support until July 2027, after the project ends. The cost is two languages and two builds.
