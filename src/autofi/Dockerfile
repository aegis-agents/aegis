FROM python:3.13.0-bookworm
LABEL maintainer="Yoll"
ARG APP_FILE_NAME=app.py

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /aegis

ENV PYTHONPATH=/aegis

RUN pip install --upgrade pip && \
    pip install uv

COPY pyproject.toml uv.lock ./
COPY autofi_core ./autofi_core
COPY cdp_sender ./cdp_sender
COPY autofi_agent ./autofi_agent
COPY autofi_uagent ./autofi_uagent

RUN uv export --no-dev | uv pip install --system -r -

COPY ${APP_FILE_NAME} .

ENTRYPOINT ["python3", "-u", "${APP_FILE_NAME}"]