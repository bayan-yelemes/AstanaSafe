import json
from app.database import SessionLocal
from app.routers.ai import build_summary, fallback_forecast, ask_gemini_json
from datetime import date

db = SessionLocal()
target_date = "2026-05-03"

print("--- 1. Сбор данных из БД ---")
try:
    summary = build_summary(db, target_date)
    print(f"Найдено отчетов: {summary['total_reports']}")
    print(f"Уровень риска: {summary['risk_level']}")
except Exception as e:
    print(f"Ошибка при сборке summary: {e}")
    summary = None

if summary:
    print("\n--- 2. Попытка вызвать Gemini API ---")
    prompt = f"Return JSON with 'insight' field. Context: {json.dumps(summary)}"
    try:
        res = ask_gemini_json(prompt)
        if res:
            print("Gemini ответил успешно!")
            print(res)
        else:
            print("Gemini вернул пустой ответ.")
    except Exception as e:
        print(f"Ошибка Gemini API: {e}")

    print("\n--- 3. Проверка Fallback (запасной вариант) ---")
    fallback = fallback_forecast(summary)
    print(f"Fallback Insight: {fallback['insight']}")
    print(f"Fallback Rec: {fallback['recommendation']}")

db.close()
