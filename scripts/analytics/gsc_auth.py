#!/usr/bin/env python3
"""
Разовая OAuth-авторизация в Google Search Console.

Зачем отдельный скрипт: организационная политика GCP
(`iam.disableServiceAccountKeyCreation`) запрещает скачивать ключи
сервис-аккаунтов, поэтому ходим в API от имени владельца ресурса — обычным
OAuth-клиентом типа Desktop. Плюс побочный: не нужно отдельно выдавать права
роботу в Search Console, они уже есть у пользователя.

Запуск (один раз):
    pip3 install --user google-auth google-auth-oauthlib
    python3 scripts/analytics/gsc_auth.py ~/Downloads/client_secret_*.json

Скрипт откроет браузер, попросит подтвердить доступ и сохранит refresh-токен
в ~/.config/segurotenerife/gsc-token.json (chmod 600). Дальше report.py
обновляет access-токен сам, браузер больше не нужен.

ВАЖНО: приложение в OAuth consent screen должно быть переведено в статус
"In production". У приложения в статусе "Testing" с внешней аудиторией
refresh-токен протухает через 7 дней, и отчёты молча перестанут работать.
"""
import json
import os
import stat
import sys
from pathlib import Path

# Только чтение статистики. Права на изменение сайта не запрашиваем.
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]
TOKEN_PATH = Path.home() / ".config" / "segurotenerife" / "gsc-token.json"


def main() -> int:
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        print(
            "Нет зависимостей. Установите:\n"
            "    pip3 install --user google-auth google-auth-oauthlib",
            file=sys.stderr,
        )
        return 1

    if len(sys.argv) != 2:
        print(f"Использование: {sys.argv[0]} <путь к client_secret.json>", file=sys.stderr)
        return 1

    client_file = Path(sys.argv[1]).expanduser()
    if not client_file.is_file():
        print(f"Файл не найден: {client_file}", file=sys.stderr)
        return 1

    # Проверяем, что это OAuth-клиент, а не ключ сервис-аккаунта: у второго
    # другая структура, и ошибка была бы неочевидной.
    data = json.loads(client_file.read_text())
    if "installed" not in data and "web" not in data:
        kind = data.get("type", "неизвестный формат")
        print(
            f"Это не OAuth-клиент (тип: {kind}).\n"
            "Нужен JSON из Credentials → Create credentials → OAuth client ID →\n"
            "тип «Desktop app».",
            file=sys.stderr,
        )
        return 1

    flow = InstalledAppFlow.from_client_secrets_file(str(client_file), SCOPES)
    # access_type=offline + prompt=consent — иначе refresh_token не выдадут
    # при повторной авторизации того же клиента.
    creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")

    if not creds.refresh_token:
        print(
            "Google не вернул refresh_token. Отзовите доступ приложению на\n"
            "https://myaccount.google.com/permissions и запустите скрипт заново.",
            file=sys.stderr,
        )
        return 1

    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json())
    os.chmod(TOKEN_PATH, stat.S_IRUSR | stat.S_IWUSR)  # 600

    print(f"Готово. Токен сохранён: {TOKEN_PATH} (права 600)")
    print("Проверка: python3 scripts/analytics/report.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
