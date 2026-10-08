FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.10.0 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev --no-editable

# The git commit the image is built from, stored with each register entry.
# Declared after the installs so a new commit does not reinstall them.
ARG CLEARCARE_PIPELINE_VERSION
ENV CLEARCARE_PIPELINE_VERSION=$CLEARCARE_PIPELINE_VERSION

USER 65534:65534
ENTRYPOINT ["/app/.venv/bin/python", "-m"]
