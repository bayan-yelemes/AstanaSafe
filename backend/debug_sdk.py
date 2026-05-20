import json
import google.generativeai as genai
from app.database import SessionLocal
from app.routers.ai import build_summary, GEMINI_API_KEY
from datetime import date

db = SessionLocal()
target_date = "2026-05-03"

print(f"KEY: {GEMINI_API_KEY[:8]}...")

print("\n--- 1. Сбор данных ---")
summary = build_summary(db, target_date)
print(f"Отчетов: {summary['total_reports']}")

print("\n--- 2. Тест Gemini SDK ---")
try:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"Переведи на русский: Hello, how are you? Context: {json.dumps(summary)}"
    
    print("Отправка запроса...")
    response = model.generate_content(prompt)
    print("Ответ получен!")
    print(response.text)
except Exception as e:
    print(f"ОШИБКА SDK: {e}")

db.close()
