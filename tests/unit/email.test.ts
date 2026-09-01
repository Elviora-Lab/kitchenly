import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());
const resendCtorMock = vi.hoisted(() =>
  vi.fn(() => ({
    emails: {
      send: sendMock,
    },
  })),
);

vi.mock('resend', () => ({
  Resend: resendCtorMock,
}));

async function loadEmailModule(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_ENVIRONMENT = 'development';
  process.env.NEXT_PUBLIC_SITE_NAME = 'Kitchenly';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  setOptionalEnv('RESEND_API_KEY', env.RESEND_API_KEY);
  setOptionalEnv('EMAIL_FROM', env.EMAIL_FROM);
  setOptionalEnv('EMAIL_REPLY_TO', env.EMAIL_REPLY_TO);
  return import('@/server/email/resend');
}

function setOptionalEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe('sendEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
    resendCtorMock.mockClear();
  });

  it('logs locally and does not call Resend when no API key is configured', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail, isEmailConfigured } = await loadEmailModule();

    await expect(
      sendEmail({
        to: 'customer@example.com',
        subject: 'Order received',
        html: '<p>Thanks</p>',
      }),
    ).resolves.toEqual({ id: null });

    expect(isEmailConfigured()).toBe(false);
    expect(resendCtorMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      '[email:dev]',
      'Order received',
      '\u2192',
      'customer@example.com',
    );
    log.mockRestore();
  });

  it('sends with the default Kitchenly sender when Resend is configured', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'email_123' } });
    const { sendEmail, isEmailConfigured } = await loadEmailModule({
      RESEND_API_KEY: 're_test_123',
    });

    await expect(
      sendEmail({
        to: 'customer@example.com',
        subject: 'Your Kitchenly order',
        html: '<p>Thanks</p>',
        text: 'Thanks',
      }),
    ).resolves.toEqual({ id: 'email_123' });

    expect(isEmailConfigured()).toBe(true);
    expect(resendCtorMock).toHaveBeenCalledWith('re_test_123');
    expect(sendMock).toHaveBeenCalledWith({
      from: 'Kitchenly <support@kitchenly.com.pk>',
      to: 'customer@example.com',
      subject: 'Your Kitchenly order',
      html: '<p>Thanks</p>',
      text: 'Thanks',
      replyTo: undefined,
    });
  });

  it('uses configured sender and reply-to addresses', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'email_456' } });
    const { sendEmail } = await loadEmailModule({
      RESEND_API_KEY: 're_test_456',
      EMAIL_FROM: 'Kitchenly Orders <orders@kitchenly.com.pk>',
      EMAIL_REPLY_TO: 'support@kitchenly.com.pk',
    });

    await sendEmail({
      to: ['one@example.com', 'two@example.com'],
      subject: 'Order received',
      html: '<p>Thanks</p>',
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: 'Kitchenly Orders <orders@kitchenly.com.pk>',
      to: ['one@example.com', 'two@example.com'],
      subject: 'Order received',
      html: '<p>Thanks</p>',
      text: undefined,
      replyTo: 'support@kitchenly.com.pk',
    });
  });
});
