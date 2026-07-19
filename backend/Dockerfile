FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static (admin/DRF assets) for WhiteNoise. Safe defaults let this run
# at build time without a database or real secret.
RUN DJANGO_DEBUG=False DJANGO_SECRET_KEY=build python manage.py collectstatic --noinput

EXPOSE 8000

# Run migrations then start Gunicorn. $PORT is provided by Render/Railway.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 120"]
