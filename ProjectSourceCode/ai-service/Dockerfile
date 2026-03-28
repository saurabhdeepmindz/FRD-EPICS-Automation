FROM python:3.12-slim AS base

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Development stage
FROM deps AS development
COPY . .
EXPOSE 5000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--reload"]

# Production stage
FROM deps AS production
ENV PYTHONUNBUFFERED=1
COPY . .
EXPOSE 5000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "2"]
