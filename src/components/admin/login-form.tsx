'use client';

import { useActionState } from 'react';

import { loginAction } from '@/lib/actions/auth';

const initialState = { error: undefined as string | undefined };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="login-password" className="mb-1 block text-xs text-ink-soft dark:text-cream-soft">
          管理员密码
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full border border-rule bg-paper px-3 py-2 text-sm text-ink dark:border-night-rule dark:bg-night dark:text-cream"
        />
      </div>

      {state.error ? (
        <p className="border border-rust px-3 py-2 text-sm text-rust dark:border-rust-soft dark:text-rust-soft" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-rust px-4 py-2 text-sm text-paper transition-colors hover:bg-rust-soft disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rust-soft dark:text-night dark:hover:bg-rust"
      >
        {pending ? '登录中…' : '登录'}
      </button>
    </form>
  );
}
