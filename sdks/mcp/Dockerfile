FROM python:3.12-slim

WORKDIR /app
COPY pyproject.toml .
COPY wago_mcp/ wago_mcp/

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["wago-mcp", "--http", "--port", "8000"]
