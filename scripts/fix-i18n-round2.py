#!/usr/bin/env python3
"""Patch notification.runFix & notification.openTerminal into all IntelliJ locale files."""
import os, re

IDEA_MSG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "idea-plugin", "src", "main", "resources", "messages")

PATCHES = {
    "ar":    {"notification.runFix": "تشغيل أمر الإصلاح",   "notification.openTerminal": "فتح الطرفية"},
    "de":    {"notification.runFix": "Reparaturbefehl ausführen", "notification.openTerminal": "Terminal öffnen"},
    "es":    {"notification.runFix": "Ejecutar comando de reparación", "notification.openTerminal": "Abrir terminal"},
    "fr":    {"notification.runFix": "Exécuter la commande de réparation", "notification.openTerminal": "Ouvrir le terminal"},
    "id":    {"notification.runFix": "Jalankan perintah perbaikan", "notification.openTerminal": "Buka Terminal"},
    "it":    {"notification.runFix": "Esegui comando di riparazione", "notification.openTerminal": "Apri terminale"},
    "ja":    {"notification.runFix": "修復コマンドを実行",    "notification.openTerminal": "ターミナルを開く"},
    "ko":    {"notification.runFix": "수정 명령 실행",        "notification.openTerminal": "터미널 열기"},
    "pt":    {"notification.runFix": "Executar comando de reparo", "notification.openTerminal": "Abrir terminal"},
    "ru":    {"notification.runFix": "Выполнить команду исправления", "notification.openTerminal": "Открыть терминал"},
    "th":    {"notification.runFix": "เรียกใช้คำสั่งซ่อมแซม", "notification.openTerminal": "เปิดเทอร์มินัล"},
    "vi":    {"notification.runFix": "Chạy lệnh sửa lỗi",   "notification.openTerminal": "Mở Terminal"},
    "zh_TW": {"notification.runFix": "執行修復命令",          "notification.openTerminal": "開啟終端機"},
}

for locale, kv in PATCHES.items():
    fp = os.path.join(IDEA_MSG_DIR, f"GitAiBundle_{locale}.properties")
    with open(fp, "r", encoding="utf-8") as f:
        content = f.read()
    existing = {re.match(r"^([a-zA-Z0-9_.\-]+)\s*=", l).group(1)
                for l in content.splitlines()
                if l.strip() and not l.startswith("#") and not l.startswith("!") and re.match(r"^([a-zA-Z0-9_.\-]+)\s*=", l)}
    added = []
    lines = []
    for k, v in kv.items():
        if k not in existing:
            lines.append(f"{k}={v}")
            added.append(k)
    if lines:
        if not content.endswith("\n"):
            content += "\n"
        content += "\n".join(lines) + "\n"
        with open(fp, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  ✅ {locale}: +{len(added)} → {', '.join(added)}")
    else:
        print(f"  ⏭  {locale}: ok")

print("\n🎉 Done!")
