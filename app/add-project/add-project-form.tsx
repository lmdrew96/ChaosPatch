'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

type ProjectFormState = {
  error: string | null;
  success: boolean;
};

export default function AddProjectForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<ProjectFormState>({
    error: null,
    success: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setFormState({ error: null, success: false });

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;

    if (!name || !slug) {
      setFormState({ error: 'Name and slug are required.', success: false });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Failed to add project.');
      }

      const newProject = await response.json();
      setFormState({ error: null, success: true });
      router.push(`/projects/${newProject.slug}`);
    } catch (e: any) {
      setFormState({ error: e.message || 'Failed to add project.', success: false });
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Project Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          required
          disabled={isLoading}
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
          Project Slug (unique identifier for URL)
        </label>
        <input
          type="text"
          id="slug"
          name="slug"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          required
          pattern="[a-z0-9-]+"
          title="Slug must contain only lowercase letters, numbers, and hyphens."
          disabled={isLoading}
        />
      </div>
      {formState.error && <p className="text-red-500 text-sm">{formState.error}</p>}
      {formState.success && (
        <p className="text-green-500 text-sm">Project added successfully!</p>
      )}
      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Adding...' : 'Add Project'}
        </Button>
      </div>
    </form>
  );
}