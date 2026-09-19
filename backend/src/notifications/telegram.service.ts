import { Injectable, Logger } from "@nestjs/common";

/**
 * fetch/undici сворачивает сетевые ошибки в общий "TypeError: fetch failed" — настоящая причина
 * (ENOTFOUND, ECONNREFUSED, таймаут, TLS...) лежит в цепочке .cause и без неё непонятна из лога.
 */
function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [e.message];
  let cause: unknown = (e as { cause?: unknown }).cause;
  for (let depth = 0; cause && depth < 3; depth++) {
    if (!(cause instanceof Error)) {
      parts.push(String(cause));
      break;
    }
    const code = (cause as NodeJS.ErrnoException).code;
    parts.push(code ? `${cause.message} (${code})` : cause.message);
    cause = (cause as { cause?: unknown }).cause;
  }
  return parts.join(" ← ");
}

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
      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          ...(this.topicId ? { message_thread_id: Number(this.topicId) } : {}),
          text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
      }
    } catch (e) {
      this.logger.warn(`Telegram sendMessage error: ${describeError(e)}`);
    }
  }
}
