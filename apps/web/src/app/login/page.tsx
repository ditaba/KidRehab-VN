'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Field, FormError, Input } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/language-switcher';
import { MessageKey, useT } from '@/lib/i18n';

const makeSchema = (t: (key: MessageKey) => string) =>
  z.object({
    email: z.string().trim().min(1, t('login.emailRequired')).email(t('login.emailInvalid')),
    password: z.string().min(1, t('login.passwordRequired')),
  });
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const t = useT();
  const schema = useMemo(() => makeSchema(t), [t]);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await login(values.email, values.password);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError(t('login.invalidCredentials'));
      else if (e instanceof ApiError) setError(errorMessage(e));
      else setError(t('login.unableToSignIn'));
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-gradient-to-br from-primary-50 via-white to-success-50 px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-600 text-2xl font-bold text-white shadow-card">K</span>
          <h1 className="mt-4 text-3xl">KidRehab</h1>
          <p className="mt-1 text-slate-500">{t('common.tagline')}</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-6 sm:p-8" noValidate>
          <h2>{t('login.title')}</h2>
          <FormError message={error} />
          <Field label={t('login.email')} error={errors.email?.message}>
            <Input type="email" autoComplete="username" autoFocus {...register('email')} />
          </Field>
          <Field label={t('login.password')} error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            {t('login.submit')}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">{t('login.staffOnly')}</p>
      </div>
    </div>
  );
}
