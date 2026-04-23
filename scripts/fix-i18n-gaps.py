#!/usr/bin/env python3
"""
Patches all missing i18n keys across VS Code and IntelliJ locale files.
Run once, then verify with check-i18n-coverage.sh.
"""
import json
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VSCODE_DIR = os.path.join(REPO, "vscode-extension")
IDEA_MSG_DIR = os.path.join(REPO, "idea-plugin", "src", "main", "resources", "messages")

# ═══════════════════════════════════════════════
# VS Code — missing keys per locale
# ═══════════════════════════════════════════════
VSCODE_PATCHES = {
    "ar": {
        "extension.displayName": "Git AI - أداة تلميع الإيداعات غير المتزامنة",
        "extension.description": "محسّن ذكي لرسائل Git — الحالة والتحكم والسجلات مباشرة في VS Code",
        "command.clean": "تنظيف الإيداعات المتوقفة",
        "view.history.name": "سجل الذكاء الاصطناعي",
    },
    "de": {
        "extension.displayName": "Git AI - Asynchroner Commit-Polierer",
        "extension.description": "KI-gestützter Git-Commit-Verbesserer — Status, Steuerung und Logs direkt in VS Code",
        "command.clean": "Hängende Commits bereinigen",
        "view.history.name": "KI-Verlauf",
    },
    "es": {
        "extension.displayName": "Git AI - Pulidor asíncrono de commits",
        "extension.description": "Mejorador de mensajes de commit con IA — estado, controles y registros directamente en VS Code",
        "command.clean": "Limpiar commits atascados",
        "view.history.name": "Historial de IA",
    },
    "fr": {
        "extension.displayName": "Git AI - Polisseur de commits asynchrone",
        "extension.description": "Améliorateur de messages de commit par IA — statut, contrôles et logs directement dans VS Code",
        "command.clean": "Nettoyer les commits bloqués",
        "view.history.name": "Historique IA",
    },
    "id": {
        "extension.displayName": "Git AI - Pemolesan Commit Asinkron",
        "extension.description": "Penyempurna pesan commit Git bertenaga AI — status, kontrol, dan log langsung di VS Code",
        "command.clean": "Bersihkan commit yang macet",
        "view.history.name": "Riwayat AI",
    },
    "it": {
        "extension.displayName": "Git AI - Lucidatura asincrona dei commit",
        "extension.description": "Miglioratore di messaggi di commit basato su IA — stato, controlli e log direttamente in VS Code",
        "command.clean": "Pulisci commit bloccati",
        "view.history.name": "Cronologia IA",
    },
    "ja": {
        "extension.displayName": "Git AI - 非同期コミット推敲ツール",
        "extension.description": "AI搭載のGitコミットメッセージ最適化 — ステータス・操作・ログをVS Codeで直接確認",
        "command.clean": "停滞コミットをクリーンアップ",
        "view.history.name": "AI履歴",
    },
    "ko": {
        "extension.displayName": "Git AI - 비동기 커밋 윤색기",
        "extension.description": "AI 기반 Git 커밋 메시지 향상 — VS Code에서 직접 상태, 제어, 로그 확인",
        "command.clean": "멈춘 커밋 정리",
        "view.history.name": "AI 기록",
    },
    "pt": {
        "extension.displayName": "Git AI - Polidor assíncrono de commits",
        "extension.description": "Aprimorador de mensagens de commit com IA — status, controles e logs diretamente no VS Code",
        "command.clean": "Limpar commits travados",
        "view.history.name": "Histórico de IA",
    },
    "ru": {
        "extension.displayName": "Git AI - Асинхронная полировка коммитов",
        "extension.description": "ИИ-улучшение сообщений коммитов Git — статус, управление и логи прямо в VS Code",
        "command.clean": "Очистить застрявшие коммиты",
        "view.history.name": "История ИИ",
    },
    "th": {
        "extension.displayName": "Git AI - เครื่องมือขัดเกลาคอมมิตแบบอะซิงโครนัส",
        "extension.description": "เพิ่มประสิทธิภาพข้อความ Git commit ด้วย AI — ดูสถานะ ควบคุม และบันทึกใน VS Code",
        "command.clean": "ล้างคอมมิตที่ค้าง",
        "view.history.name": "ประวัติ AI",
    },
    "vi": {
        "extension.displayName": "Git AI - Trau chuốt commit bất đồng bộ",
        "extension.description": "Công cụ nâng cấp message commit Git bằng AI — trạng thái, điều khiển và nhật ký ngay trong VS Code",
        "command.clean": "Dọn dẹp commit bị treo",
        "view.history.name": "Lịch sử AI",
    },
    "zh-cn": {
        "view.history.name": "AI 历史",
    },
    "zh-tw": {
        "extension.displayName": "Git AI - 非同步提交潤飾工具",
        "extension.description": "以 AI 驅動的 Git 提交訊息增強器 — 在 VS Code 中直接查看狀態、操作及日誌",
        "command.clean": "清理卡住的歷史提交",
        "view.history.name": "AI 歷史",
    },
}

# ═══════════════════════════════════════════════
# IntelliJ — missing keys per locale
# ═══════════════════════════════════════════════
# NOTE: plugin.name and plugin.description are NOT rendered via resource bundle by
# IntelliJ (they come from plugin.xml CDATA), so they are cosmetic / future-proof.
# We still add them for consistency.
IDEA_PATCHES = {
    "ar": {
        "plugin.name": "Git AI - أداة تلميع الإيداعات غير المتزامنة",
        "plugin.description": "أداة ذكاء اصطناعي لتحسين رسائل الإيداع في Git بشكل غير متزامن.",
        "action.GitAi.CleanCommits.text": "تنظيف الإيداعات المتوقفة",
        "action.GitAi.CleanCommits.description": "تنظيف بادئات التحميل المتوقفة من الإيداعات القديمة",
        "action.clean.progress": "Git AI: جاري تنظيف الإيداعات...",
        "action.clean.success": "Git AI: تم تنظيف الإيداعات بنجاح!",
        "action.clean.failed": "فشل التنظيف: {0}",
        "action.clean.title": "تنظيف الإيداعات",
        "action.clean.pushedWarning": "بعض الإيداعات المستهدفة تم دفعها بالفعل. تعديلها سيعيد كتابة تاريخ Git ويتطلب دفعًا إجباريًا. هل تريد المتابعة؟",
        "toolwindow.tab.history": "سجل الذكاء الاصطناعي",
        "toolwindow.tab.stats": "الإنتاجية",
    },
    "de": {
        "plugin.name": "Git AI - Asynchroner Commit-Polierer",
        "plugin.description": "KI-gestütztes Tool zur asynchronen Verbesserung von Git-Commit-Nachrichten.",
        "action.GitAi.CleanCommits.text": "Hängende Commits bereinigen",
        "action.GitAi.CleanCommits.description": "Hängende Ladezeichen-Präfixe aus alten Commits entfernen",
        "action.clean.progress": "Git AI: Commits bereinigen...",
        "action.clean.success": "Git AI: Commits erfolgreich bereinigt!",
        "action.clean.failed": "Bereinigung fehlgeschlagen: {0}",
        "action.clean.title": "Commits bereinigen",
        "action.clean.pushedWarning": "Einige Ziel-Commits wurden bereits gepusht. Die Bearbeitung wird die Git-Historie umschreiben und einen Force-Push erfordern. Fortfahren?",
        "toolwindow.tab.history": "KI-Verlauf",
        "toolwindow.tab.stats": "Produktivität",
    },
    "es": {
        "plugin.name": "Git AI - Pulidor asíncrono de commits",
        "plugin.description": "Herramienta de IA para mejorar mensajes de commit de Git de forma asíncrona.",
        "action.GitAi.CleanCommits.text": "Limpiar commits atascados",
        "action.GitAi.CleanCommits.description": "Eliminar prefijos de carga atascados de commits históricos",
        "action.clean.progress": "Git AI: Limpiando commits...",
        "action.clean.success": "Git AI: ¡Commits limpiados correctamente!",
        "action.clean.failed": "Limpieza fallida: {0}",
        "action.clean.title": "Limpiar commits",
        "action.clean.pushedWarning": "Algunos commits objetivo ya han sido enviados. Editarlos reescribirá el historial de Git y requerirá un push forzado. ¿Continuar?",
        "toolwindow.tab.history": "Historial de IA",
        "toolwindow.tab.stats": "Productividad",
    },
    "fr": {
        "plugin.name": "Git AI - Polisseur de commits asynchrone",
        "plugin.description": "Outil IA pour améliorer les messages de commit Git de manière asynchrone.",
        "action.GitAi.CleanCommits.text": "Nettoyer les commits bloqués",
        "action.GitAi.CleanCommits.description": "Supprimer les préfixes de chargement bloqués des anciens commits",
        "action.clean.progress": "Git AI : Nettoyage des commits...",
        "action.clean.success": "Git AI : Commits nettoyés avec succès !",
        "action.clean.failed": "Nettoyage échoué : {0}",
        "action.clean.title": "Nettoyer les commits",
        "action.clean.pushedWarning": "Certains commits ciblés ont déjà été poussés. Les modifier réécrira l'historique Git et nécessitera un push forcé. Continuer ?",
        "toolwindow.tab.history": "Historique IA",
        "toolwindow.tab.stats": "Productivité",
    },
    "id": {
        "plugin.name": "Git AI - Pemolesan Commit Asinkron",
        "plugin.description": "Alat AI untuk menyempurnakan pesan commit Git secara asinkron.",
        "action.GitAi.CleanCommits.text": "Bersihkan commit yang macet",
        "action.GitAi.CleanCommits.description": "Bersihkan prefiks loading yang macet dari commit lama",
        "action.clean.progress": "Git AI: Membersihkan commit...",
        "action.clean.success": "Git AI: Commit berhasil dibersihkan!",
        "action.clean.failed": "Pembersihan gagal: {0}",
        "action.clean.title": "Bersihkan Commit",
        "action.clean.pushedWarning": "Beberapa commit target sudah dipush. Mengeditnya akan menulis ulang riwayat Git dan memerlukan force push. Lanjutkan?",
        "toolwindow.tab.history": "Riwayat AI",
        "toolwindow.tab.stats": "Produktivitas",
    },
    "it": {
        "plugin.name": "Git AI - Lucidatura asincrona dei commit",
        "plugin.description": "Strumento IA per migliorare i messaggi di commit Git in modo asincrono.",
        "action.GitAi.CleanCommits.text": "Pulisci commit bloccati",
        "action.GitAi.CleanCommits.description": "Rimuovi i prefissi di caricamento bloccati dai commit storici",
        "action.clean.progress": "Git AI: Pulizia dei commit...",
        "action.clean.success": "Git AI: Commit puliti con successo!",
        "action.clean.failed": "Pulizia fallita: {0}",
        "action.clean.title": "Pulisci commit",
        "action.clean.pushedWarning": "Alcuni commit target sono già stati pushati. La modifica riscriverà la cronologia Git e richiederà un push forzato. Procedere?",
        "toolwindow.tab.history": "Cronologia IA",
        "toolwindow.tab.stats": "Produttività",
    },
    "ja": {
        "plugin.name": "Git AI - 非同期コミット推敲ツール",
        "plugin.description": "AI搭載のGitコミットメッセージ最適化ツール。非同期で自動的にコミットメッセージを改善します。",
        "action.GitAi.CleanCommits.text": "停滞コミットをクリーンアップ",
        "action.GitAi.CleanCommits.description": "過去のコミットに残ったローディングプレフィックスを除去",
        "action.clean.progress": "Git AI: コミットをクリーンアップ中...",
        "action.clean.success": "Git AI: コミットのクリーンアップ完了！",
        "action.clean.failed": "クリーンアップ失敗: {0}",
        "action.clean.title": "コミットのクリーンアップ",
        "action.clean.pushedWarning": "対象のコミットの一部はすでにプッシュされています。編集するとGit履歴が書き換えられ、強制プッシュが必要になります。続行しますか？",
        "toolwindow.tab.history": "AI履歴",
        "toolwindow.tab.stats": "生産性",
    },
    "ko": {
        "plugin.name": "Git AI - 비동기 커밋 윤색기",
        "plugin.description": "AI 기반 Git 커밋 메시지 향상 도구 — 비동기로 자동으로 커밋 메시지를 개선합니다.",
        "action.GitAi.CleanCommits.text": "멈춘 커밋 정리",
        "action.GitAi.CleanCommits.description": "과거 커밋의 멈춘 로딩 접두사 제거",
        "action.clean.progress": "Git AI: 커밋 정리 중...",
        "action.clean.success": "Git AI: 커밋 정리 완료!",
        "action.clean.failed": "정리 실패: {0}",
        "action.clean.title": "커밋 정리",
        "action.clean.pushedWarning": "일부 대상 커밋이 이미 푸시되었습니다. 편집하면 Git 히스토리가 재작성되고 강제 푸시가 필요합니다. 계속하시겠습니까?",
        "toolwindow.tab.history": "AI 기록",
        "toolwindow.tab.stats": "생산성",
    },
    "pt": {
        "plugin.name": "Git AI - Polidor assíncrono de commits",
        "plugin.description": "Ferramenta de IA para aprimorar mensagens de commit do Git de forma assíncrona.",
        "action.GitAi.CleanCommits.text": "Limpar commits travados",
        "action.GitAi.CleanCommits.description": "Remover prefixos de carregamento travados de commits antigos",
        "action.clean.progress": "Git AI: Limpando commits...",
        "action.clean.success": "Git AI: Commits limpos com sucesso!",
        "action.clean.failed": "Limpeza falhou: {0}",
        "action.clean.title": "Limpar commits",
        "action.clean.pushedWarning": "Alguns commits alvo já foram enviados. Editá-los reescreverá o histórico do Git e exigirá um push forçado. Continuar?",
        "toolwindow.tab.history": "Histórico de IA",
        "toolwindow.tab.stats": "Produtividade",
    },
    "ru": {
        "plugin.name": "Git AI - Асинхронная полировка коммитов",
        "plugin.description": "ИИ-инструмент для улучшения сообщений коммитов Git в асинхронном режиме.",
        "action.GitAi.CleanCommits.text": "Очистить застрявшие коммиты",
        "action.GitAi.CleanCommits.description": "Удалить зависшие префиксы загрузки из старых коммитов",
        "action.clean.progress": "Git AI: Очистка коммитов...",
        "action.clean.success": "Git AI: Коммиты успешно очищены!",
        "action.clean.failed": "Ошибка очистки: {0}",
        "action.clean.title": "Очистка коммитов",
        "action.clean.pushedWarning": "Некоторые целевые коммиты уже были отправлены. Их редактирование перепишет историю Git и потребует принудительной отправки. Продолжить?",
        "toolwindow.tab.history": "История ИИ",
        "toolwindow.tab.stats": "Продуктивность",
    },
    "th": {
        "plugin.name": "Git AI - เครื่องมือขัดเกลาคอมมิตแบบอะซิงโครนัส",
        "plugin.description": "เครื่องมือ AI สำหรับปรับปรุงข้อความ commit ของ Git แบบอะซิงโครนัส",
        "action.GitAi.CleanCommits.text": "ล้างคอมมิตที่ค้าง",
        "action.GitAi.CleanCommits.description": "ลบคำนำหน้าโหลดที่ค้างออกจากคอมมิตเก่า",
        "action.clean.progress": "Git AI: กำลังล้างคอมมิต...",
        "action.clean.success": "Git AI: ล้างคอมมิตสำเร็จ!",
        "action.clean.failed": "การล้างล้มเหลว: {0}",
        "action.clean.title": "ล้างคอมมิต",
        "action.clean.pushedWarning": "คอมมิตบางรายการถูกพุชไปแล้ว การแก้ไขจะเขียน Git history ใหม่และต้องใช้ force push คุณต้องการดำเนินการต่อหรือไม่?",
        "toolwindow.tab.history": "ประวัติ AI",
        "toolwindow.tab.stats": "ประสิทธิภาพ",
    },
    "vi": {
        "plugin.name": "Git AI - Trau chuốt commit bất đồng bộ",
        "plugin.description": "Công cụ AI để cải thiện thông điệp commit Git một cách bất đồng bộ.",
        "action.GitAi.CleanCommits.text": "Dọn dẹp commit bị treo",
        "action.GitAi.CleanCommits.description": "Xóa các tiền tố đang tải bị treo khỏi các commit cũ",
        "action.clean.progress": "Git AI: Đang dọn dẹp commit...",
        "action.clean.success": "Git AI: Đã dọn dẹp commit thành công!",
        "action.clean.failed": "Dọn dẹp thất bại: {0}",
        "action.clean.title": "Dọn dẹp Commit",
        "action.clean.pushedWarning": "Một số commit mục tiêu đã được push. Chỉnh sửa chúng sẽ viết lại lịch sử Git và yêu cầu force push. Tiếp tục?",
        "toolwindow.tab.history": "Lịch sử AI",
        "toolwindow.tab.stats": "Năng suất",
    },
    "zh_CN": {
        "toolwindow.tab.history": "AI 历史",
        "toolwindow.tab.stats": "生产力",
    },
    "zh_TW": {
        "plugin.name": "Git AI - 非同步提交潤飾工具",
        "plugin.description": "以 AI 驅動的 Git 提交訊息增強工具，完全非同步地將提交訊息改寫為規範格式。",
        "action.GitAi.CleanCommits.text": "清理卡住的歷史提交",
        "action.GitAi.CleanCommits.description": "清除歷史提交中殘留的載入前綴",
        "action.clean.progress": "Git AI: 正在清理提交...",
        "action.clean.success": "Git AI: 提交清理成功！",
        "action.clean.failed": "清理失敗: {0}",
        "action.clean.title": "清理提交",
        "action.clean.pushedWarning": "部分目標提交已推播至遠端。編輯將改寫 Git 歷史並需要強制推播。是否繼續？",
        "toolwindow.tab.history": "AI 歷史",
        "toolwindow.tab.stats": "生產力",
    },
}


def patch_vscode():
    """Patch VS Code package.nls.*.json files."""
    print("─── Patching VS Code ───")
    for locale, new_keys in VSCODE_PATCHES.items():
        filepath = os.path.join(VSCODE_DIR, f"package.nls.{locale}.json")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        added = []
        for k, v in new_keys.items():
            if k not in data:
                data[k] = v
                added.append(k)

        if added:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"  ✅ {locale}: added {len(added)} keys → {', '.join(added)}")
        else:
            print(f"  ⏭  {locale}: nothing to add")


def patch_idea():
    """Patch IntelliJ GitAiBundle_*.properties files."""
    print("─── Patching IntelliJ ───")
    for locale, new_keys in IDEA_PATCHES.items():
        filepath = os.path.join(IDEA_MSG_DIR, f"GitAiBundle_{locale}.properties")
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        # Parse existing keys
        existing_keys = set()
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("!"):
                continue
            m = re.match(r"^([a-zA-Z0-9_.\-]+)\s*=", line)
            if m:
                existing_keys.add(m.group(1))

        added = []
        lines_to_add = []
        for k, v in new_keys.items():
            if k not in existing_keys:
                lines_to_add.append(f"{k}={v}")
                added.append(k)

        if lines_to_add:
            # Append to end of file
            if not content.endswith("\n"):
                content += "\n"
            content += "\n".join(lines_to_add) + "\n"
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  ✅ {locale}: added {len(added)} keys → {', '.join(added)}")
        else:
            print(f"  ⏭  {locale}: nothing to add")


if __name__ == "__main__":
    patch_vscode()
    print()
    patch_idea()
    print("\n🎉 Done! Run scripts/check-i18n-coverage.sh to verify.\n")
