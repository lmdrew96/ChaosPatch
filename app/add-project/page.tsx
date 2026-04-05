import AddProjectForm from './add-project-form';

export const metadata = {
  title: 'Add New Project',
  description: 'Add a new project to your workspace.',
};

export default function AddProjectPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="mb-8 text-4xl font-bold">Add New Project</h1>
      <AddProjectForm />
    </div>
  );
}