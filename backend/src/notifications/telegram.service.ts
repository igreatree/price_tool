import { Injectable, Logger } from "@nestjs/common";

/**
 * Уведомления об автовкл/выкл правил по расписанию (см. RuleSchedulerService). Настраивается
 * переменными окружения TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / TELEGRAM_TOPIC_ID — если бот не
 * настроен (нет токена/чата), сообщения просто не отправляются, без ошибок.
 */
@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);
    private readonly token = process.env.TELEGRAM_BOT_TOKEN;
    private readonly chatId = process.env.TELEGRAM_CHAT_ID;
    private readonly topicId = process.env.TELEGRAM_TOPIC_ID;

    /** Никогда не бросает исключение — сбой отправки в Telegram не должен ронять пересчёт цен. */
    async sendMessage(text: string): Promise<void> {
        if (!this.token || !this.chatId) return;
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${this.token}/sendMessage`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: this.chatId,
                        ...(this.topicId
                            ? { message_thread_id: Number(this.topicId) }
                            : {}),
                        text,
                    }),
                },
            );
            if (!res.ok) {
                this.logger.warn(
                    `Telegram sendMessage failed: ${res.status} ${await res.text()}`,
                );
            }
        } catch (e) {
            this.logger.warn(
                `Telegram sendMessage error: ${e instanceof Error ? e.message : String(e)}`,
            );
        }
    }
}
