'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Field, FormError, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, user, loading } = useAuth();
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
      if (e instanceof ApiError && e.status === 401) setError('Invalid email or password');
      else if (e instanceof ApiError) setError(e.message);
      else setError('Unable to sign in. Please try again.');
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-50 via-white to-success-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-600 text-2xl font-bold text-white shadow-card">K</span>
          <h1 className="mt-4 text-3xl">KidRehab</h1>
          <p className="mt-1 text-slate-500">Making pediatric rehabilitation progress measurable</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-6 sm:p-8" noValidate>
          <h2>Sign in</h2>
          <FormError message={error} />
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="username" autoFocus {...register('email')} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">For clinic staff only. All access is logged.</p>
      </div>
    </div>
  );
}
