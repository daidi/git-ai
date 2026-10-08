// Package i18n provides lightweight internationalization for CLI output messages.
// Resolution order: config ui_language → LANG/LC_ALL env → default (en).
// Only English and Chinese are supported.
package i18n

import (
	"fmt"
	"os"
	"strings"
	"sync"
)

// currentLang holds the resolved language code ("en" or "zh").
var (
	currentLang string
	once        sync.Once
)

// messages maps lang → key → format-string.
var messages = map[string]map[string]string{
	"en": {
		// ── init ──
		"init.start":         "🔧 Initializing Git AI in %s\n\n",
		"init.created_state": "  ✅ Created %s\n",
		"init.state_json":    "  ✅ Initialized external runtime state\n",
		"init.backed_up":     "  📦 Preserved existing %s hook as %s.git-ai.backup\n",
		"init.installed":     "  ✅ Installed %s hook\n",
		"init.ssh_warn":      "\n  ⚠️  %s\n",
		"init.ssh_block":     "     Push policy set to 'block' (manual push required).\n",
		"init.ssh_hint":      "     To enable auto-push, run: ssh-add\n\n",
		"init.done":          "\n🎉 Git AI initialized!\n\n",
		"init.next":          "Next steps:\n",
		"init.step1":         "  1. Set your API key:  git-ai config set api_key <key> --global\n",
		"init.step2":         "  2. (Optional) Change model: git-ai config set model <model>\n",
		"init.step3":         "  3. (Optional) Change format: git-ai config set message_format gitmoji\n",
		"init.step4":         "  4. Commit as usual:   git commit -m \"your message\"\n",

		// ── uninstall ──
		"uninstall.start":         "🗑️  Uninstalling Git AI from %s\n\n",
		"uninstall.removed":       "  ✅ Removed %s hook\n",
		"uninstall.skipped":       "  ℹ️  Skipped %s (not a Git AI hook)\n",
		"uninstall.restored":      "  📦 Restored original %s hook from backup\n",
		"uninstall.backup_kept":   "  ⚠️  Backup exists but current hook was modified — keeping both\n",
		"uninstall.current":       "     Current: %s\n",
		"uninstall.backup":        "     Backup:  %s\n",
		"uninstall.state_warn":    "\n  ⚠️  Warning: could not remove %s: %v\n",
		"uninstall.state_removed": "\n  ✅ Removed state directory\n",
		"uninstall.done":          "\n🎉 Git AI hooks removed.\n",
		"uninstall.config_kept":   "User configuration was kept in the application config directory.\n\n",

		// ── retry ──
		"retry.start":   "🔄 Re-generating commit message for %s...\n",
		"retry.done":    "✅ Commit message updated:\n   %s\n",
		"retry.notify":  "Retry: %s",
		"retry.started": "🔄 Retry started safely in the background.\n",

		// ── undo ──
		"undo.restoring": "⏪ Restoring original message: %q\n",
		"undo.done":      "✅ Original message restored.\n",

		// ── recover ──
		"recover.nothing_to_recover": "ℹ️  Nothing to recover — no stuck polishing state detected.\n",
		"recover.rolling_back":       "⏪ Rolling back to original message...\n",
		"recover.rolled_back":        "✅ Rolled back to: %q\n",
		"recover.success":            "✅ Recovery complete.\n",

		// ── config ──
		"config.set": "✅ Set %s = %s (%s)\n",

		"setup.terminal_required":  "Interactive setup requires a terminal; use git-ai config set for non-interactive configuration.",
		"setup.restore_failed":     "Could not restore terminal settings.",
		"setup.intro":              "Git AI setup — user settings only. Ctrl-C/Ctrl-D cancels without saving.\nModel discovery contacts your chosen endpoint; the optional test sends only an OK prompt, never repository data.\nRepository overrides and environment variables still take precedence after setup.",
		"setup.provider":           "Provider",
		"setup.invalid_provider":   "Choose one of the listed provider IDs.",
		"setup.endpoint":           "API base URL (HTTPS, or localhost HTTP)",
		"setup.key":                "API key (hidden)",
		"setup.keep_key":           "API key (hidden; leave blank to keep the existing key)",
		"setup.key_required":       "This provider requires an API key; configuration was not saved.",
		"setup.discover":           "Fetch available models now? (y/n)",
		"setup.models_unavailable": "Model discovery is unavailable; enter a model ID manually and use the connection test to verify it.",
		"setup.models_stale":       "Using a stale cached model list; model availability may have changed.",
		"setup.model":              "Model ID or displayed number (up to 30 models shown)",
		"setup.format":             "Message format (plain / conventional / gitmoji / subject-body)",
		"setup.language":           "Output language (e.g. en, zh-CN, ja)",
		"setup.summary":            "\nReview settings:\n  Provider: %q\n  Endpoint: %q\n  Model: %q\n  Format: %q\n  Language: %q\n  API key: never displayed",
		"setup.custom_template":    "Your existing custom prompt is retained and may override the selected style/language.",
		"setup.test":               "Test the selected model before saving? (y/n)",
		"setup.test_failed":        "Connection test failed; configuration was not saved. Check the endpoint, credentials and model, then retry setup.",
		"setup.test_ok":            "Connection test succeeded.",
		"setup.save":               "Save these user settings? (y/n)",
		"setup.yes_no":             "Please answer y or n.",
		"setup.canceled":           "Setup canceled; configuration was not changed.",
		"setup.saved":              "User settings saved. Repository settings and environment overrides were not changed.\nNext: run git-ai init in each repository that needs hooks, then commit as usual.",

		// ── hook (post-commit) ──
		"hook.forked":       "✨ Git AI: polishing in background (PID %d)\n",
		"hook.polished":     "Commit polished: %s",
		"hook.ai_failed":    "AI polishing failed: %v",
		"hook.amend_failed": "Amend failed: %v",
		"hook.push_failed":  "Push failed: %v",
		"hook.pushed":       "Pushed to %s",

		// ── push errors (for IDE display) ──
		"push_err.ssh_auth":   "Push failed: SSH key not loaded. Run 'ssh-add' in your terminal.",
		"push_err.https_auth": "Push failed: Git credentials not saved. Please do a manual 'git push' once to save credentials.",
		"push_err.generic":    "Push failed: %v",

		// ── init (HTTPS hint) ──
		"init.https_hint": "     To fix, run in terminal:\n       %s\n     Then do a manual 'git push' once to save credentials.\n     After that, background push will work automatically.\n\n",

		// ── hook (pre-push) ──
		"prepush.queued":    "⏳ Git AI: AI is polishing your commit. Push queued — will auto-push when ready. (Please ignore the push failure warning, it will push automatically after polishing.)\n",
		"prepush.save_warn": "Git AI: warning: could not save pending push: %v\n",

		// ── errors ──
		"err.polishing": "AI is currently polishing — please wait",
		"err.no_undo":   "no original message to restore — nothing to undo",
	},
	"zh": {
		"setup.terminal_required":  "交互式配置需要终端；非交互环境请使用 git-ai config set。",
		"setup.restore_failed":     "无法恢复终端设置。",
		"setup.intro":              "Git AI 配置向导 — 只修改用户级设置。Ctrl-C/Ctrl-D 取消且不保存。\n模型发现会连接所选服务；可选连通性测试只发送 OK 提示，不发送仓库数据。\n配置后，仓库设置和环境变量仍拥有更高优先级。",
		"setup.provider":           "服务协议",
		"setup.invalid_provider":   "请选择列表中的服务协议 ID。",
		"setup.endpoint":           "API 基础地址（HTTPS，或本机 HTTP）",
		"setup.key":                "API 密钥（隐藏输入）",
		"setup.keep_key":           "API 密钥（隐藏输入；留空保留现有密钥）",
		"setup.key_required":       "该服务需要 API 密钥；配置未保存。",
		"setup.discover":           "现在获取可用模型？(y/n)",
		"setup.models_unavailable": "暂时无法获取模型列表；请手动输入模型 ID，并通过连通性测试验证。",
		"setup.models_stale":       "正在使用过期的模型缓存；模型可用性可能已变化。",
		"setup.model":              "模型 ID 或列表编号（最多显示 30 个模型）",
		"setup.format":             "消息格式（plain / conventional / gitmoji / subject-body）",
		"setup.language":           "输出语言（例如 en、zh-CN、ja）",
		"setup.summary":            "\n确认设置：\n  服务协议：%q\n  API 地址：%q\n  模型：%q\n  格式：%q\n  输出语言：%q\n  API 密钥：不会显示",
		"setup.custom_template":    "现有自定义提示模板将保留，它可能覆盖所选格式或语言。",
		"setup.test":               "保存前测试所选模型？(y/n)",
		"setup.test_failed":        "连通性测试失败；配置未保存。请检查地址、密钥和模型后重新运行向导。",
		"setup.test_ok":            "连通性测试成功。",
		"setup.save":               "保存这些用户级设置？(y/n)",
		"setup.yes_no":             "请输入 y 或 n。",
		"setup.canceled":           "已取消配置，原设置未改动。",
		"setup.saved":              "用户级设置已保存，仓库设置和环境变量未改动。\n下一步：在需要安装 hooks 的仓库运行 git-ai init，然后照常提交。",
		// ── init ──
		"init.start":         "🔧 正在初始化 Git AI（%s）\n\n",
		"init.created_state": "  ✅ 已创建 %s\n",
		"init.state_json":    "  ✅ 已初始化工作区外部运行状态\n",
		"init.backed_up":     "  📦 已保留原有 %s 钩子 → %s.git-ai.backup\n",
		"init.installed":     "  ✅ 已安装 %s 钩子\n",
		"init.ssh_warn":      "\n  ⚠️  %s\n",
		"init.ssh_block":     "     推送策略已设为 'block'（需手动推送）。\n",
		"init.ssh_hint":      "     若需自动推送，请运行: ssh-add\n\n",
		"init.done":          "\n🎉 Git AI 初始化完成！\n\n",
		"init.next":          "接下来：\n",
		"init.step1":         "  1. 设置 API 密钥:  git-ai config set api_key <key> --global\n",
		"init.step2":         "  2.（可选）更换模型: git-ai config set model <model>\n",
		"init.step3":         "  3.（可选）更换格式: git-ai config set message_format gitmoji\n",
		"init.step4":         "  4. 照常提交即可:   git commit -m \"你的消息\"\n",

		// ── uninstall ──
		"uninstall.start":         "🗑️  正在从 %s 卸载 Git AI\n\n",
		"uninstall.removed":       "  ✅ 已移除 %s 钩子\n",
		"uninstall.skipped":       "  ℹ️  已跳过 %s（非 Git AI 钩子）\n",
		"uninstall.restored":      "  📦 已从备份恢复 %s 钩子\n",
		"uninstall.backup_kept":   "  ⚠️  存在备份但当前钩子已被修改 — 两者均保留\n",
		"uninstall.current":       "     当前: %s\n",
		"uninstall.backup":        "     备份: %s\n",
		"uninstall.state_warn":    "\n  ⚠️  警告: 无法移除 %s: %v\n",
		"uninstall.state_removed": "\n  ✅ 已移除状态目录\n",
		"uninstall.done":          "\n🎉 Git AI 钩子已移除。\n",
		"uninstall.config_kept":   "用户配置仍保留在应用配置目录中。\n\n",

		// ── retry ──
		"retry.start":   "🔄 正在为 %s 重新生成提交信息...\n",
		"retry.done":    "✅ 提交信息已更新:\n   %s\n",
		"retry.notify":  "已重试: %s",
		"retry.started": "🔄 已在后台安全启动重试。\n",

		// ── undo ──
		"undo.restoring": "⏪ 正在恢复原始信息: %q\n",
		"undo.done":      "✅ 已恢复原始提交信息。\n",

		// ── recover ──
		"recover.nothing_to_recover": "ℹ️  没有需要恢复的内容 — 未检测到卡住的润色状态。\n",
		"recover.rolling_back":       "⏪ 正在回滚到原始消息...\n",
		"recover.rolled_back":        "✅ 已回滚到: %q\n",
		"recover.success":            "✅ 恢复完成。\n",

		// ── config ──
		"config.set": "✅ 已设置 %s = %s（%s）\n",

		// ── hook (post-commit) ──
		"hook.forked":       "✨ Git AI: 正在后台润色（PID %d）\n",
		"hook.polished":     "提交信息已润色: %s",
		"hook.ai_failed":    "AI 润色失败: %v",
		"hook.amend_failed": "修订失败: %v",
		"hook.push_failed":  "推送失败: %v",
		"hook.pushed":       "已推送到 %s",

		// ── push errors (for IDE display) ──
		"push_err.ssh_auth":   "推送失败: SSH 密钥未加载。请在终端运行 'ssh-add'。",
		"push_err.https_auth": "推送失败: Git 凭据未保存。请先手动执行一次 'git push' 以保存凭据。",
		"push_err.generic":    "推送失败: %v",

		// ── init (HTTPS hint) ──
		"init.https_hint": "     修复方法，请在终端运行:\n       %s\n     然后手动执行一次 git push 以保存凭据。\n     之后后台推送将自动生效。\n\n",

		// ── hook (pre-push) ──
		"prepush.queued":    "⏳ Git AI: AI 正在润色你的提交，推送已排队 — 完成后将自动推送。（请忽略推送失败的警告，消息润色完成后会自动提交推送）\n",
		"prepush.save_warn": "Git AI: 警告: 无法保存待推送状态: %v\n",

		// ── errors ──
		"err.polishing": "AI 正在润色中 — 请稍候",
		"err.no_undo":   "没有可恢复的原始信息 — 无需撤销",
	},
}

// Init sets the current language. Call once with the config value (may be empty).
// If configLang is empty, auto-detects from LANG/LC_ALL environment variables.
func Init(configLang string) {
	once.Do(func() {
		currentLang = resolve(configLang)
	})
}

// T returns the localized format string for the given key.
// Falls back to English if the key is missing in the current language.
func T(key string) string {
	lang := currentLang
	if lang == "" {
		lang = "en"
	}
	if dict, ok := messages[lang]; ok {
		if s, ok := dict[key]; ok {
			return s
		}
	}
	// Fallback to English.
	if s, ok := messages["en"][key]; ok {
		return s
	}
	return key
}

// Sprintf is a convenience wrapper: T(key) fed into fmt.Sprintf.
func Sprintf(key string, args ...any) string {
	return fmt.Sprintf(T(key), args...)
}

// resolve determines the language from config or environment.
func resolve(configLang string) string {
	if configLang != "" {
		return normalize(configLang)
	}
	// Auto-detect from environment.
	for _, envKey := range []string{"LC_ALL", "LC_MESSAGES", "LANG"} {
		if v := os.Getenv(envKey); v != "" {
			return normalize(v)
		}
	}
	return "en"
}

// normalize maps a locale string (e.g. "zh_CN.UTF-8") to "en" or "zh".
func normalize(s string) string {
	s = strings.ToLower(s)
	if strings.HasPrefix(s, "zh") {
		return "zh"
	}
	return "en"
}
