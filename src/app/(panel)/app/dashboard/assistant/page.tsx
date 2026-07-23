import { redirect } from 'next/navigation';

/** Assistant page disabled — redirect to dashboard. */
export default function AssistantPage() {
    redirect('/app/dashboard');
}
