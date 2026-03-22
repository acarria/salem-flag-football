'use client';

import React, { useState } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import BaseLayout from '@/components/layout/BaseLayout';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { submitContactForm } from '@/services/public/contact';
import { isValidEmail } from '@/utils/validation';

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  else if (form.name.trim().length > 100) errors.name = 'Name must be 100 characters or fewer';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!isValidEmail(form.email.trim())) errors.email = 'Enter a valid email address';
  if (!form.subject.trim()) errors.subject = 'Subject is required';
  else if (form.subject.trim().length > 200) errors.subject = 'Subject must be 200 characters or fewer';
  if (!form.message.trim()) errors.message = 'Message is required';
  else if (form.message.trim().length > 2000) errors.message = 'Message must be 2000 characters or fewer';
  return errors;
}

export default function ContactPage() {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [form, setForm] = useState<FormState>({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    if (!executeRecaptcha) {
      setSubmitError('reCAPTCHA not ready. Please try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await executeRecaptcha('contact');
      await submitContactForm({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        recaptcha_token: token,
      });
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="section-label mb-2">GET IN TOUCH</div>
        <h1 className="text-3xl font-semibold text-white mb-4">Contact Us</h1>
        <p className="text-sm text-[#A0A0A0] mb-12 leading-relaxed">
          Questions about registration, rules, or anything else? Send us a message and we'll get back to you.
        </p>

        {submitted ? (
          <div className="border-t border-white/10 pt-8">
            <div className="flex items-start gap-3">
              <span className="status-dot bg-accent mt-1.5 shrink-0"></span>
              <div>
                <p className="text-white font-medium mb-1">Message sent</p>
                <p className="text-sm text-[#A0A0A0]">
                  Thanks for reaching out. We'll get back to you as soon as possible.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input
                label="Name"
                placeholder="Your name"
                value={form.name}
                onChange={handleChange('name')}
                error={errors.name}
                maxLength={100}
              />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange('email')}
                error={errors.email}
              />
            </div>

            <Input
              label="Subject"
              placeholder="What's this about?"
              value={form.subject}
              onChange={handleChange('subject')}
              error={errors.subject}
              maxLength={200}
            />

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#A0A0A0]">Message</label>
              <textarea
                rows={6}
                placeholder="Your message..."
                value={form.message}
                onChange={handleChange('message')}
                maxLength={2000}
                className={`w-full px-3 py-2 bg-[#1E1E1E] border rounded-md focus:outline-none focus:ring-0 focus:border-accent/40 text-white placeholder:text-[#6B6B6B] transition-colors resize-none ${
                  errors.message ? 'border-red-500/60' : 'border-white/10'
                }`}
              />
              <div className="flex justify-between items-center">
                {errors.message ? (
                  <p className="text-xs text-red-400">{errors.message}</p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-[#6B6B6B] ml-auto">{form.message.length}/2000</p>
              </div>
            </div>

            {submitError && (
              <div className="text-sm text-red-400 border border-red-500/20 bg-red-500/5 rounded-md px-4 py-3">
                {submitError}
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} size="md">
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        )}
      </div>
    </BaseLayout>
  );
}
